from flask import Flask, request, jsonify, send_from_directory # type: ignore
from flask_cors import CORS # type: ignore
from flask_sqlalchemy import SQLAlchemy # type: ignore
import re
import os
from werkzeug.utils import secure_filename # type: ignore
from dotenv import load_dotenv # type: ignore

# Cargar las variables de entorno desde el archivo .env
load_dotenv()

app = Flask(__name__)
CORS(app)

# --- Configuración de la Base de Datos ---
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') or 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- Configuración para Subida de Archivos ---
# NOTA IMPORTANTE: En producción (Render), las imágenes guardadas en 'uploads' no son persistentes.
# Se borrarán con cada despliegue o reinicio de tu servicio.
# Para un uso real, necesitarás un servicio de almacenamiento en la nube (Cloudinary, S3, etc.).
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Definición del Modelo de Departamento ---
class Department(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(100), nullable=False)
    contact = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    bedrooms = db.Column(db.Integer, nullable=False)
    bathrooms = db.Column(db.Float, nullable=False)
    description = db.Column(db.Text, nullable=False)
    image = db.Column(db.String(200), nullable=False,
                     default='https://placehold.co/300x200/cccccc/FFFFFF?text=Sin+Imagen')

    def __repr__(self):
        return f"Department('{self.title}', '{self.location}', '{self.price}', '{self.image}')"

# --- RUTA PRINCIPAL (ROOT ROUTE) ---
# Esta es la ruta que se ejecutará cuando alguien visite la URL base de tu aplicación (ej. https://tudominio.onrender.com)
@app.route('/')
def home():
    # Puedes devolver HTML directamente, redirigir, o simplemente un mensaje.
    # Para una API pura, es útil para verificar que está "viva".
    return "<h1>¡Tu API de Encuentra Tu Espacio Ideal está funcionando!</h1><p>Visita /api/departments para ver los departamentos.</p>"

# --- Ruta para servir archivos estáticos (imágenes subidas) ---
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# --- Rutas de la API ---

@app.route('/api/departments', methods=['GET'])
def get_departments():
    search_query = request.args.get('query')

    if search_query:
        departments = Department.query.filter(
            (Department.title.ilike(f'%{search_query}%')) |
            (Department.location.ilike(f'%{search_query}%'))
        ).all()
    else:
        departments = Department.query.all()

    departments_list = []
    for dep in departments:
        image_url = dep.image
        if not image_url.startswith('http://') and not image_url.startswith('https://'):
            image_url = request.url_root + 'uploads/' + image_url

        departments_list.append({
            "id": dep.id,
            "title": dep.title,
            "location": dep.location,
            "contact": dep.contact,
            "price": dep.price,
            "bedrooms": dep.bedrooms,
            "bathrooms": dep.bathrooms,
            "description": dep.description,
            "image": image_url
        })
    return jsonify(departments_list)

@app.route('/api/departments', methods=['POST'])
def add_department():
    title = request.form.get('title', '').strip()
    location = request.form.get('location', '').strip()
    contact = request.form.get('contact', '').strip()
    price_str = request.form.get('price')
    bedrooms_str = request.form.get('bedrooms')
    bathrooms_str = request.form.get('bathrooms')
    description = request.form.get('description', '').strip()

    image_file = request.files.get('image')

    errors = {}

    if not title:
        errors['title'] = "El título es obligatorio."
    if not location:
        errors['location'] = "La ubicación es obligatoria."
    if not contact:
        errors['contact'] = "El número de contacto es obligatorio."
    elif not re.fullmatch(r'^\+?[\d\s\-\(\)]{7,20}$', contact):
        errors['contact'] = "Formato de contacto inválido. Debe ser un número de teléfono válido (7-20 caracteres)."
    if not description:
        errors['description'] = "La descripción es obligatoria."

    try:
        price = float(price_str)
        if price <= 0:
            errors['price'] = "El precio debe ser un número positivo."
    except (TypeError, ValueError):
        errors['price'] = "El precio es obligatorio y debe ser un número válido."

    try:
        bedrooms = int(bedrooms_str)
        if bedrooms <= 0:
            errors['bedrooms'] = "El número de habitaciones debe ser un entero positivo."
    except (TypeError, ValueError):
        errors['bedrooms'] = "El número de habitaciones es obligatorio y debe ser un entero válido."

    try:
        bathrooms = float(bathrooms_str)
        if bathrooms <= 0:
            errors['bathrooms'] = "El número de baños es obligatorio y debe ser un número positivo."
    except (TypeError, ValueError):
        errors['bathrooms'] = "El número de baños es obligatorio y debe ser un número válido."

    image_filename_for_db = 'https://placehold.co/300x200/cccccc/FFFFFF?text=Sin+Imagen'
    returned_image_url_for_frontend = image_filename_for_db

    if image_file and image_file.filename != '':
        if allowed_file(image_file.filename):
            filename = secure_filename(image_file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

            counter = 1
            original_filename_no_ext, ext = os.path.splitext(filename)
            while os.path.exists(file_path):
                filename = f"{original_filename_no_ext}_{counter}{ext}"
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                counter += 1

            try:
                image_file.save(file_path)
                image_filename_for_db = filename
                returned_image_url_for_frontend = request.url_root + 'uploads/' + image_filename_for_db
            except Exception as e:
                errors['image'] = f"Error al guardar la imagen: {str(e)}"
        else:
            errors['image'] = "Tipo de archivo no permitido. Solo se aceptan PNG, JPG, JPEG, GIF."

    if errors:
        return jsonify({"message": "Error de validación", "errors": errors}), 400

    new_department = Department(
        title=title,
        location=location,
        contact=contact,
        price=price,
        bedrooms=bedrooms,
        bathrooms=bathrooms,
        description=description,
        image=image_filename_for_db
    )
    db.session.add(new_department)
    db.session.commit()

    return jsonify({
        "id": new_department.id,
        "title": new_department.title,
        "location": new_department.location,
        "contact": new_department.contact,
        "price": new_department.price,
        "bedrooms": new_department.bedrooms,
        "bathrooms": new_department.bathrooms,
        "description": new_department.description,
        "image": returned_image_url_for_frontend
    }), 201

@app.route('/api/departments/<int:department_id>', methods=['DELETE'])
def delete_department(department_id):
    department = db.session.get(Department, department_id)
    if department is None:
        return jsonify({"message": "Departamento no encontrado"}), 404

    if department.image and \
       not department.image.startswith('http://') and \
       not department.image.startswith('https://'):
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], department.image)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                print(f"Archivo eliminado: {file_path}")
            except OSError as e:
                print(f"Error al eliminar el archivo {file_path}: {e}")

    db.session.delete(department)
    db.session.commit()
    return jsonify({"message": "Departamento eliminado correctamente"}), 200

@app.route('/api/departments/<int:department_id>', methods=['PUT'])
def update_department(department_id):
    department = db.session.get(Department, department_id)
    if department is None:
        return jsonify({"message": "Departamento no encontrado"}), 404

    errors = {}

    title_data = request.form.get('title')
    location_data = request.form.get('location')
    contact_data = request.form.get('contact')
    price_data = request.form.get('price')
    bedrooms_data = request.form.get('bedrooms')
    bathrooms_data = request.form.get('bathrooms')
    description_data = request.form.get('description')

    image_file = request.files.get('image')
    image_url_unchanged = request.form.get('image_url_unchanged') == 'true'

    if title_data is not None:
        title = title_data.strip()
        if not title:
            errors['title'] = "El título no puede estar vacío."
        else:
            department.title = title

    if location_data is not None:
        location = location_data.strip()
        if not location:
            errors['location'] = "La ubicación no puede estar vacía."
        else:
            department.location = location

    if contact_data is not None:
        contact = contact_data.strip()
        if not contact:
            errors['contact'] = "El contacto no puede estar vacío."
        elif not re.fullmatch(r'^\+?[\d\s\-\(\)]{7,20}$', contact):
            errors['contact'] = "Formato de contacto inválido. Debe ser un número de teléfono válido (7-20 caracteres)."
        else:
            department.contact = contact

    if price_data is not None:
        try:
            price = float(price_data)
            if price <= 0:
                errors['price'] = "El precio debe ser un número positivo."
            else:
                department.price = price
        except (TypeError, ValueError):
            errors['price'] = "El precio debe ser un número válido."

    if bedrooms_data is not None:
        try:
            bedrooms = int(bedrooms_data)
            if bedrooms <= 0:
                errors['bedrooms'] = "El número de habitaciones debe ser un entero positivo."
            else:
                department.bedrooms = bedrooms
        except (TypeError, ValueError):
            errors['bedrooms'] = "El número de habitaciones es obligatorio y debe ser un entero válido."

    if bathrooms_data is not None:
        try:
            bathrooms = float(bathrooms_data)
            if bathrooms <= 0:
                errors['bathrooms'] = "El número de baños debe ser un número positivo."
            else:
                department.bathrooms = bathrooms
        except (TypeError, ValueError):
            errors['bathrooms'] = "El número de baños es obligatorio y debe ser un número válido."

    if description_data is not None:
        description = description_data.strip()
        if not description:
            errors['description'] = "La descripción no puede estar vacía."
        else:
            department.description = description

    if image_file and image_file.filename != '':
        if allowed_file(image_file.filename):
            if department.image and \
               not department.image.startswith('http://') and \
               not department.image.startswith('https://'):
                old_file_path = os.path.join(app.config['UPLOAD_FOLDER'], department.image)
                if os.path.exists(old_file_path):
                    try:
                        os.remove(old_file_path)
                        print(f"Archivo eliminado: {old_file_path}")
                    except OSError as e:
                        print(f"Error al eliminar el archivo antiguo {old_file_path}: {e}")

            filename = secure_filename(image_file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

            counter = 1
            original_filename_no_ext, ext = os.path.splitext(filename)
            while os.path.exists(file_path):
                filename = f"{original_filename_no_ext}_{counter}{ext}"
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                counter += 1

            try:
                image_file.save(file_path)
                department.image = filename
            except Exception as e:
                errors['image'] = f"Error al guardar la nueva imagen: {str(e)}"
        else:
            errors['image'] = "Tipo de archivo de imagen no permitido."
    elif 'image' in request.form and not image_url_unchanged:
        if department.image and \
           not department.image.startswith('http://') and \
           not department.image.startswith('https://'):
            old_file_path = os.path.join(app.config['UPLOAD_FOLDER'], department.image)
            if os.path.exists(old_file_path):
                try:
                    os.remove(old_file_path)
                except OSError as e:
                    print(f"Error al eliminar el archivo antiguo {old_file_path}: {e}")
        department.image = 'https://placehold.co/300x200/cccccc/FFFFFF?text=Sin+Imagen'

    if errors:
        return jsonify({"message": "Error de validación", "errors": errors}), 400

    db.session.commit()

    returned_image_url = department.image
    if not returned_image_url.startswith('http://') and not returned_image_url.startswith('https://'):
        returned_image_url = request.url_root + 'uploads/' + returned_image_url

    return jsonify({
        "id": department.id,
        "title": department.title,
        "location": department.location,
        "contact": department.contact,
        "price": department.price,
        "bedrooms": department.bedrooms,
        "bathrooms": department.bathrooms,
        "description": department.description,
        "image": returned_image_url
    }), 200

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)