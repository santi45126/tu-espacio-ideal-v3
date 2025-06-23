from flask import Flask, request, jsonify, send_from_directory # type: ignore
from flask_cors import CORS # type: ignore
from flask_sqlalchemy import SQLAlchemy # type: ignore
import re
import os
from werkzeug.utils import secure_filename # type: ignore
from dotenv import load_dotenv # type: ignore # Importar load_dotenv

# Cargar las variables de entorno desde el archivo .env
load_dotenv()

app = Flask(__name__)
CORS(app)

# --- Configuración de la Base de Datos ---
# Se obtiene la URL de la base de datos de la variable de entorno 'DATABASE_URL'
# (que ahora será cargada por dotenv si existe en .env, o del sistema si la definiste).
# Si no está definida, usa SQLite como fallback.
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') or 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- Configuración para Subida de Archivos ---
# NOTA IMPORTANTE: Para producción (deploy), esta lógica de guardar en 'uploads' no funcionará.
# Necesitarás un servicio de almacenamiento en la nube como Cloudinary o Amazon S3.
# Esta configuración es principalmente para el desarrollo local con SQLite.
UPLOAD_FOLDER = 'uploads' # Carpeta donde se guardarán las imágenes
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'} # Extensiones de archivo permitidas

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 # Límite de 16MB para los archivos

# Crear la carpeta de uploads si no existe al iniciar la app
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Función para verificar si la extensión del archivo es permitida
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
    # image ahora almacenará el nombre del archivo guardado o la URL por defecto
    image = db.Column(db.String(200), nullable=False,
                      default='https://placehold.co/300x200/cccccc/FFFFFF?text=Sin+Imagen')

    def __repr__(self):
        return f"Department('{self.title}', '{self.location}', '{self.price}', '{self.image}')"

# --- Ruta para servir archivos estáticos (imágenes subidas) ---
# Esta ruta permite que las imágenes en la carpeta 'uploads' sean accesibles por URL.
# En producción, esto será manejado por un servidor web (Nginx) o un servicio de almacenamiento en la nube.
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
        # Si la imagen almacenada NO es una URL http/https (es decir, es un nombre de archivo local),
        # construimos la URL completa para el frontend.
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
            "image": image_url # Enviamos la URL completa al frontend
        })
    return jsonify(departments_list)

@app.route('/api/departments', methods=['POST'])
def add_department():
    # Cuando se suben archivos, los datos del formulario vienen en request.form
    # y los archivos en request.files. request.get_json() ya no es adecuado.
    title = request.form.get('title', '').strip()
    location = request.form.get('location', '').strip()
    contact = request.form.get('contact', '').strip()
    price_str = request.form.get('price') # Se recibe como string
    bedrooms_str = request.form.get('bedrooms') # Se recibe como string
    bathrooms_str = request.form.get('bathrooms') # Se recibe como string
    description = request.form.get('description', '').strip()

    image_file = request.files.get('image') # Obtener el archivo de imagen del campo 'image'

    errors = {}

    # Validaciones para campos de texto
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

    # Validaciones para campos numéricos y conversión
    try:
        price = float(price_str) # Convertir a float
        if price <= 0:
            errors['price'] = "El precio debe ser un número positivo."
    except (TypeError, ValueError):
        errors['price'] = "El precio es obligatorio y debe ser un número válido."

    try:
        bedrooms = int(bedrooms_str) # Convertir a int
        if bedrooms <= 0:
            errors['bedrooms'] = "El número de habitaciones debe ser un entero positivo."
    except (TypeError, ValueError):
        errors['bedrooms'] = "El número de habitaciones es obligatorio y debe ser un entero válido."

    try:
        bathrooms = float(bathrooms_str) # Convertir a float (por 0.5)
        if bathrooms <= 0:
            errors['bathrooms'] = "El número de baños es obligatorio y debe ser un número positivo."
    except (TypeError, ValueError):
        errors['bathrooms'] = "El número de baños es obligatorio y debe ser un número válido."

    # --- Manejo de la subida de imagen ---
    image_filename_for_db = 'https://placehold.co/300x200/cccccc/FFFFFF?text=Sin+Imagen' # Valor por defecto
    returned_image_url_for_frontend = image_filename_for_db # Inicialmente la URL por defecto

    if image_file and image_file.filename != '': # Si se subió un archivo y no está vacío
        if allowed_file(image_file.filename): # Verificar extensión permitida
            # Generar un nombre de archivo seguro para evitar problemas de ruta y seguridad
            filename = secure_filename(image_file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

            # --- Lógica para generar un nombre de archivo único si ya existe ---
            counter = 1
            original_filename_no_ext, ext = os.path.splitext(filename)
            while os.path.exists(file_path):
                filename = f"{original_filename_no_ext}_{counter}{ext}"
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                counter += 1

            try:
                image_file.save(file_path) # Guardar el archivo en el servidor
                image_filename_for_db = filename # Guardar solo el nombre del archivo en la DB
                # Construir la URL completa para la respuesta del frontend
                returned_image_url_for_frontend = request.url_root + 'uploads/' + image_filename_for_db
            except Exception as e:
                errors['image'] = f"Error al guardar la imagen: {str(e)}"
        else:
            errors['image'] = "Tipo de archivo no permitido. Solo se aceptan PNG, JPG, JPEG, GIF."
    # Si no se subió una imagen, se mantendrá el valor por defecto en `image_filename_for_db`

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
        image=image_filename_for_db # Guardar el nombre del archivo o la URL por defecto en la DB
    )
    db.session.add(new_department)
    db.session.commit()

    # Devolver la URL completa de la imagen al frontend
    return jsonify({
        "id": new_department.id,
        "title": new_department.title,
        "location": new_department.location,
        "contact": new_department.contact,
        "price": new_department.price,
        "bedrooms": new_department.bedrooms,
        "bathrooms": new_department.bathrooms,
        "description": new_department.description,
        "image": returned_image_url_for_frontend # Usar la URL completa aquí
    }), 201

@app.route('/api/departments/<int:department_id>', methods=['DELETE'])
def delete_department(department_id):
    department = db.session.get(Department, department_id)
    if department is None:
        return jsonify({"message": "Departamento no encontrado"}), 404

    # --- Eliminar el archivo de imagen asociado si no es la URL por defecto ---
    # Esto es crucial para no dejar archivos "huérfanos" en el servidor.
    if department.image and \
       not department.image.startswith('http://') and \
       not department.image.startswith('https://'): # Si es un nombre de archivo local

        file_path = os.path.join(app.config['UPLOAD_FOLDER'], department.image)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                print(f"Archivo eliminado: {file_path}")
            except OSError as e:
                # Loggear el error pero no impedir la eliminación de la entrada en DB
                print(f"Error al eliminar el archivo {file_path}: {e}")

    db.session.delete(department)
    db.session.commit()
    return jsonify({"message": "Departamento eliminado correctamente"}), 200

@app.route('/api/departments/<int:department_id>', methods=['PUT'])
def update_department(department_id):
    department = db.session.get(Department, department_id)
    if department is None:
        return jsonify({"message": "Departamento no encontrado"}), 404

    # Para PUT, los campos también vienen en request.form y request.files
    errors = {}

    # Captura los campos de texto del formulario (si vienen en la request)
    # Usamos .get() sin valor por defecto aquí, porque queremos saber si el campo fue enviado.
    # El valor por defecto se aplica dentro de la validación si el campo no es None y está vacío.
    title_data = request.form.get('title')
    location_data = request.form.get('location')
    contact_data = request.form.get('contact')
    price_data = request.form.get('price')
    bedrooms_data = request.form.get('bedrooms')
    bathrooms_data = request.form.get('bathrooms')
    description_data = request.form.get('description')

    # Captura el archivo de imagen (si se envió uno nuevo)
    image_file = request.files.get('image')
    # Este campo oculto lo usaremos desde el frontend para saber si el usuario NO tocó el campo de la imagen
    image_url_unchanged = request.form.get('image_url_unchanged') == 'true'

    # Validaciones y actualización de campos de texto
    if title_data is not None: # Si el campo 'title' fue enviado en el formulario
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

    # Validaciones y actualización de price
    if price_data is not None:
        try:
            price = float(price_data)
            if price <= 0:
                errors['price'] = "El precio debe ser un número positivo."
            else:
                department.price = price
        except (TypeError, ValueError):
            errors['price'] = "El precio debe ser un número válido."

    # Validaciones y actualización de bedrooms
    if bedrooms_data is not None:
        try:
            bedrooms = int(bedrooms_data)
            if bedrooms <= 0:
                errors['bedrooms'] = "El número de habitaciones debe ser un entero positivo."
            else:
                department.bedrooms = bedrooms
        except (TypeError, ValueError):
            errors['bedrooms'] = "El número de habitaciones debe ser un entero válido."

    # Validaciones y actualización de bathrooms
    if bathrooms_data is not None:
        try:
            bathrooms = float(bathrooms_data)
            if bathrooms <= 0:
                errors['bathrooms'] = "El número de baños debe ser un número positivo."
            else:
                department.bathrooms = bathrooms
        except (TypeError, ValueError):
            errors['bathrooms'] = "El número de baños debe ser un número válido."

    # Validaciones y actualización de description
    if description_data is not None:
        description = description_data.strip()
        if not description:
            errors['description'] = "La descripción no puede estar vacía."
        else:
            department.description = description

    # --- Manejo de la subida de imagen en PUT ---
    # Esto es más complejo:
    # 1. Si se envía un nuevo archivo, se procesa.
    # 2. Si NO se envía un nuevo archivo Y el frontend indica que el campo de imagen fue tocado (vacío),
    #    significa que se quiere usar la imagen por defecto.
    # 3. Si NO se envía un nuevo archivo Y el frontend indica que el campo de imagen NO fue tocado,
    #    se mantiene la imagen existente (sin cambios).

    # Si se envió un nuevo archivo en el formulario (input type="file" no vacío)
    if image_file and image_file.filename != '':
        if allowed_file(image_file.filename):
            # Si ya había una imagen subida asociada al departamento, eliminarla antes de guardar la nueva
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

            # Generar un nombre único si el archivo ya existe
            counter = 1
            original_filename_no_ext, ext = os.path.splitext(filename)
            while os.path.exists(file_path):
                filename = f"{original_filename_no_ext}_{counter}{ext}"
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                counter += 1

            try:
                image_file.save(file_path)
                department.image = filename # Guardar el nuevo nombre del archivo en la DB
            except Exception as e:
                errors['image'] = f"Error al guardar la nueva imagen: {str(e)}"
        else:
            errors['image'] = "Tipo de archivo de imagen no permitido."
    # Si no se envió un nuevo archivo, pero el campo 'image' estaba presente en el formulario
    # (lo que indica que el usuario posiblemente borró el valor de la URL existente o el archivo subido)
    elif 'image' in request.form and not image_url_unchanged:
        # Esto significa que el campo 'image' en el formulario fue enviado
        # (por ejemplo, el campo de texto de URL de imagen se vació, o se eliminó la selección de archivo).
        # Primero, elimina la imagen antigua si era un archivo subido (no una URL externa)
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
    # Si 'image' no está en request.form (no se envió) Y no se envió un archivo, Y no se indicó que no cambió,
    # el campo de imagen se mantiene tal cual en la DB.

    if errors:
        return jsonify({"message": "Error de validación", "errors": errors}), 400

    db.session.commit()

    # Devolver la URL completa de la imagen al frontend
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
        "image": returned_image_url # Enviamos la URL completa aquí
    }), 200

if __name__ == '__main__':
    with app.app_context():
        db.create_all() # Crea las tablas si no existen
    app.run(debug=True)