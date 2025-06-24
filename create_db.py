# create_db.py
from app import app, db
import os
from dotenv import load_dotenv # type: ignore

# Asegúrate de que las variables de entorno se carguen correctamente
# si es necesario para db.create_all() fuera de app.py
load_dotenv()

# Este bloque solo se ejecutará cuando el script sea llamado directamente.
if __name__ == '__main__':
    with app.app_context():
        print("Intentando crear todas las tablas de la base de datos...")
        try:
            db.create_all()
            print("¡Tablas creadas o ya existentes!")
        except Exception as e:
            print(f"Error al crear las tablas: {e}")