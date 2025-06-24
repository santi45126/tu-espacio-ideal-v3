document.addEventListener('DOMContentLoaded', () => {
    const listingsSection = document.querySelector('#listings .department-grid');
    const publishButton = document.getElementById('publish-button');
    const modalPublish = document.getElementById('modal-publish');
    const modalDetails = document.getElementById('modal-details');
    const closeButtons = document.querySelectorAll('.close-button');
    const publishForm = document.getElementById('publish-form');

    // Add a reference to the modal title for dynamic changes
    const modalTitle = document.getElementById('modal-publish-title');

    // --- References to the new image upload elements ---
    const imageUploadInput = document.getElementById('image_upload'); // The file input
    const imagePreview = document.getElementById('image-preview');   // The <img> for preview
    const imageUrlUnchangedInput = document.getElementById('image_url_unchanged'); // Hidden input for PUT requests

    // --- Variables para la funcionalidad de búsqueda ---
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const clearSearchButton = document.getElementById('clear-search-button');

    // --- Función para mostrar notificaciones toast ---
    function showToast(message, type = 'info') { // 'info', 'success', 'error'
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.classList.add('toast', type);
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // Muestra el toast después de un pequeño retraso para la transición
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Oculta el toast después de 3 segundos
        setTimeout(() => {
            toast.classList.remove('show');
            // Elimina el toast del DOM después de que termine la transición de salida
            toast.addEventListener('transitionend', () => {
                toast.remove();
            }, { once: true });
        }, 3000);
    }

    // --- Función para mostrar mensajes de error del formulario ---
    function showValidationError(elementId, message) {
        const inputElement = document.getElementById(elementId);
        // Encuentra el elemento de error asociado o crea uno
        let errorElement = inputElement.nextElementSibling;
        if (!errorElement || !errorElement.classList.contains('error-message')) {
            errorElement = document.createElement('span');
            errorElement.classList.add('error-message');
            // Inserta el mensaje de error justo después del input
            inputElement.parentNode.insertBefore(errorElement, inputElement.nextSibling);
        }
        errorElement.textContent = message;
        errorElement.style.display = 'block'; // Asegura que el mensaje sea visible
    }

    // --- Función para ocultar mensajes de error del formulario ---
    function hideValidationError(elementId) {
        const inputElement = document.getElementById(elementId);
        // Busca el elemento de error asociado
        const errorElement = inputElement.nextElementSibling;
        if (errorElement && errorElement.classList.contains('error-message')) {
            errorElement.style.display = 'none'; // Oculta el mensaje
            errorElement.textContent = ''; // Limpia el texto
        }
    }

    // --- Base URL for the API (THIS IS THE CHANGE!) ---
    // Make sure to replace 'tu-espacio-ideal-v3.onrender.com' with your actual Render service URL.
    const API_BASE_URL = 'https://tu-espacio-ideal-v3.onrender.com';

    // --- FUNCTION TO GET AND DISPLAY DEPARTMENTS FROM THE BACKEND ---
    function fetchDepartments(query = '') {
        let url = `${API_BASE_URL}/api/departments`; // Uses the new API_BASE_URL
        if (query) {
            url = `${url}?query=${encodeURIComponent(query)}`;
            clearSearchButton.style.display = 'inline-block';
        } else {
            clearSearchButton.style.display = 'none';
        }

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log("Departamentos recibidos del backend:", data);
                displayDepartments(data);
            })
            .catch(error => {
                console.error('Error al obtener los departamentos:', error);
                showToast('No se pudieron cargar los departamentos. Por favor, asegúrate de que el servidor esté funcionando.', 'error');
            });
    }

    // --- FUNCTION TO DISPLAY DEPARTMENTS ON THE PAGE ---
    function displayDepartments(deps) {
        listingsSection.innerHTML = '';
        if (deps.length === 0 && searchInput.value) {
            listingsSection.innerHTML = '<p>No se encontraron departamentos que coincidan con la búsqueda.</p>';
            return;
        } else if (deps.length === 0) {
            listingsSection.innerHTML = '<p>No hay departamentos disponibles para mostrar. ¡Sé el primero en publicar uno!</p>';
            return;
        }

        deps.forEach(dep => {
            const card = document.createElement('div');
            card.classList.add('department-card');
            card.innerHTML = `
                <h3>${dep.title}</h3>
                <img src="${dep.image}" alt="${dep.title || 'Imagen de departamento'}"> <p>Ubicación: ${dep.location}</p>
                <p>Precio: $${dep.price ? parseFloat(dep.price).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</p>
                <p>Habitaciones: ${dep.bedrooms || 'N/A'}</p>
                <p>Baños: ${dep.bathrooms || 'N/A'}</p>
                <button class="details-button" data-id="${dep.id}">Ver Detalles</button>
                <button class="edit-button" data-id="${dep.id}">Editar</button>
                <button class="delete-button" data-id="${dep.id}">Eliminar</button>
            `;
            listingsSection.appendChild(card);
        });

        const detailButtons = document.querySelectorAll('.details-button');
        detailButtons.forEach(button => {
            button.addEventListener('click', () => {
                const departmentId = parseInt(button.getAttribute('data-id'));
                const selectedDepartment = deps.find(d => d.id === departmentId);
                if (selectedDepartment) {
                    document.getElementById('department-title').textContent = selectedDepartment.title;
                    document.getElementById('department-location').textContent = selectedDepartment.location;
                    document.getElementById('department-contact').textContent = selectedDepartment.contact;
                    // Asegúrate de que la URL de la imagen se cargue correctamente y tenga un alt
                    document.getElementById('department-image').src = selectedDepartment.image;
                    document.getElementById('department-image').alt = selectedDepartment.title || 'Imagen de departamento'; // Asegurarse que el modal de detalle también tiene alt
                    
                    // --- Display new fields in details modal ---
                    document.getElementById('department-price').textContent = selectedDepartment.price ? parseFloat(selectedDepartment.price).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A';
                    document.getElementById('department-bedrooms').textContent = selectedDepartment.bedrooms || 'N/A';
                    document.getElementById('department-bathrooms').textContent = selectedDepartment.bathrooms || 'N/A';
                    document.getElementById('department-description').textContent = selectedDepartment.description || 'Sin descripción.';

                    modalDetails.style.display = 'block';
                }
            });
        });

        const deleteButtons = document.querySelectorAll('.delete-button');
        deleteButtons.forEach(button => {
            button.addEventListener('click', () => {
                const departmentId = parseInt(button.getAttribute('data-id'));
                if (confirm('¿Estás seguro de que quieres eliminar este departamento? Esta acción es irreversible.')) {
                    deleteDepartment(departmentId);
                }
            });
        });

        const editButtons = document.querySelectorAll('.edit-button');
        editButtons.forEach(button => {
            button.addEventListener('click', () => {
                const departmentId = parseInt(button.getAttribute('data-id'));
                const selectedDepartment = deps.find(d => d.id === departmentId);
                if (selectedDepartment) {
                    // Limpiar validaciones previas al abrir el modal de edición
                    hideValidationError('title');
                    hideValidationError('location');
                    hideValidationError('contact');
                    hideValidationError('price');
                    hideValidationError('bedrooms');
                    hideValidationError('bathrooms');
                    hideValidationError('description');
                    // hideValidationError('image_upload'); // No hay validación de imagen aquí aún

                    openEditModal(selectedDepartment);
                }
            });
        });
    }

    // --- FUNCTION: Open the edit modal ---
    function openEditModal(department) {
        modalTitle.textContent = 'Editar Departamento';
        // Precargar todos los campos del formulario
        document.getElementById('title').value = department.title;
        document.getElementById('location').value = department.location;
        document.getElementById('contact').value = department.contact;
        document.getElementById('price').value = department.price;
        document.getElementById('bedrooms').value = department.bedrooms;
        document.getElementById('bathrooms').value = department.bathrooms;
        document.getElementById('description').value = department.description;
        
        // --- Cargar la imagen actual en la vista previa ---
        imagePreview.src = department.image;
        imageUploadInput.value = ''; // Limpiar el input de tipo file para que el usuario pueda seleccionar una nueva
        // Marcar que la imagen no ha sido cambiada por el usuario (útil para PUT)
        imageUrlUnchangedInput.value = 'true'; 

        publishForm.setAttribute('data-editing-id', department.id);
        modalPublish.style.display = 'block';
    }

    // --- Function to delete a department ---
    function deleteDepartment(id) {
        fetch(`${API_BASE_URL}/api/departments/${id}`, { // Uses the new API_BASE_URL
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log(data.message);
            showToast(data.message, 'success');
            fetchDepartments(searchInput.value); // Recarga la lista, manteniendo la consulta de búsqueda
        })
        .catch(error => {
            console.error('Error al eliminar el departamento:', error);
            showToast(`No se pudo eliminar el departamento: ${error.message || 'Por favor, inténtalo de nuevo.'}`, 'error');
        });
    }

    // --- INITIAL CALL: GET DEPARTMENTS ON PAGE LOAD ---
    fetchDepartments();

    // --- EVENT LISTENER FOR PUBLISH BUTTON (Open New Department Modal) ---
    publishButton.addEventListener('click', () => {
        modalTitle.textContent = 'Publicar Nuevo Departamento';
        publishForm.reset(); // Limpia todos los campos del formulario
        publishForm.removeAttribute('data-editing-id'); // Asegura que no estamos en modo edición
        // Limpiar la vista previa de la imagen y restablecer a la imagen por defecto
        imagePreview.src = 'https://placehold.co/300x200/cccccc/FFFFFF?text=Sin+Imagen';
        imageUploadInput.value = ''; // Limpiar el input de tipo file
        imageUrlUnchangedInput.value = 'true'; // Restablecer a 'true' para una nueva publicación

        // Limpiar mensajes de error de validación
        hideValidationError('title');
        hideValidationError('location');
        hideValidationError('contact');
        hideValidationError('price');
        hideValidationError('bedrooms');
        hideValidationError('bathrooms');
        hideValidationError('description');
        // hideValidationError('image_upload'); // Si tuvieras una validación para el input file

        modalPublish.style.display = 'block'; // Mostrar el modal
    });

    // --- LOGIC TO CLOSE MODALS ---
    closeButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const modal = event.target.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
                // Restablecer la imagen de preview cuando se cierra el modal
                imagePreview.src = 'https://placehold.co/300x200/cccccc/FFFFFF?text=Sin+Imagen';
                imageUploadInput.value = ''; // Limpiar el input de tipo file
                imageUrlUnchangedInput.value = 'true'; // Restablecer
            }
        });
    });

    window.addEventListener('click', (event) => {
        if (event.target === modalPublish) {
            modalPublish.style.display = 'none';
            imagePreview.src = 'https://placehold.co/300x200/cccccc/FFFFFF?text=Sin+Imagen';
            imageUploadInput.value = '';
            imageUrlUnchangedInput.value = 'true';
        }
        if (event.target === modalDetails) {
            modalDetails.style.display = 'none';
        }
    });

    // --- EVENT LISTENER FOR IMAGE UPLOAD INPUT (for preview) ---
    imageUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0]; // Get the first selected file
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result; // Set the preview image source
                // Si el usuario selecciona un archivo, entonces la imagen NO está sin cambios
                imageUrlUnchangedInput.value = 'false'; 
            };
            reader.readAsDataURL(file); // Read the file as a data URL
        } else {
            // Si el usuario borra la selección de archivo, vuelve al placeholder
            imagePreview.src = 'https://placehold.co/300x200/cccccc/FFFFFF?text=Sin+Imagen';
            // Si el input de archivo está vacío, la imagen "no se cambió" en el sentido de que no hay nuevo archivo.
            // Para el modo PUT, si no hay archivo y el input está vacío, trataremos esto como 'revertir a default'.
            imageUrlUnchangedInput.value = 'false'; // Se activa incluso si se vacía la selección
        }
    });

    // --- LOGIC TO SEND FORM DATA TO BACKEND (Now with FormData for files) ---
    publishForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // 1. Limpiar errores previos de todos los campos
        hideValidationError('title');
        hideValidationError('location');
        hideValidationError('contact');
        hideValidationError('price');
        hideValidationError('bedrooms');
        hideValidationError('bathrooms');
        hideValidationError('description');
        hideValidationError('image_upload'); // Si añadieras validación para el tipo/tamaño de archivo

        const title = document.getElementById('title').value.trim();
        const location = document.getElementById('location').value.trim();
        const contact = document.getElementById('contact').value.trim();
        const price = document.getElementById('price').value.trim();
        const bedrooms = document.getElementById('bedrooms').value.trim();
        const bathrooms = document.getElementById('bathrooms').value.trim();
        const description = document.getElementById('description').value.trim();
        const imageFile = imageUploadInput.files[0]; // Get the actual file object
        
        let isValidFrontend = true; // Variable para controlar la validación del frontend

        // 2. Realizar validación del frontend
        if (!title) { showValidationError('title', 'El título es obligatorio.'); isValidFrontend = false; }
        if (!location) { showValidationError('location', 'La ubicación es obligatoria.'); isValidFrontend = false; }
        if (!contact) { showValidationError('contact', 'El número de contacto es obligatorio.'); isValidFrontend = false; }
        
        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            showValidationError('price', 'El precio debe ser un número válido y mayor a cero.');
            isValidFrontend = false;
        } else { hideValidationError('price'); }

        const parsedBedrooms = parseInt(bedrooms);
        if (isNaN(parsedBedrooms) || parsedBedrooms <= 0) {
            showValidationError('bedrooms', 'El número de habitaciones debe ser un número entero válido y mayor a cero.');
            isValidFrontend = false;
        } else { hideValidationError('bedrooms'); }

        const parsedBathrooms = parseFloat(bathrooms);
        if (isNaN(parsedBathrooms) || parsedBathrooms <= 0) {
            showValidationError('bathrooms', 'El número de baños debe ser un número válido y mayor a cero.');
            isValidFrontend = false;
        } else { hideValidationError('bathrooms'); }

        if (!description) { showValidationError('description', 'La descripción es obligatoria.'); isValidFrontend = false; }

        // --- Adicional: Validación básica de imagen en frontend (opcional, el backend es el principal) ---
        if (imageFile) {
            const allowedTypes = ['image/png', 'image/jpeg', 'image/gif'];
            if (!allowedTypes.includes(imageFile.type)) {
                showValidationError('image_upload', 'Tipo de archivo no permitido. Solo PNG, JPG, JPEG, GIF.');
                isValidFrontend = false;
            }
            const maxSize = 16 * 1024 * 1024; // 16MB
            if (imageFile.size > maxSize) {
                showValidationError('image_upload', 'La imagen es demasiado grande (máx. 16MB).');
                isValidFrontend = false;
            }
        } else {
            // Si es una nueva publicación y no se subió imagen, se podría requerir.
            // Para este ejemplo, dejaremos que el backend asigne la imagen por defecto si no hay archivo.
        }
        
        if (!isValidFrontend) {
            showToast('Por favor, completa todos los campos obligatorios o corrige los errores.', 'error');
            return;
        }

        // --- Crear un objeto FormData para enviar datos y archivos ---
        const formData = new FormData();
        formData.append('title', title);
        formData.append('location', location);
        formData.append('contact', contact);
        formData.append('price', price); // Se envía como string, el backend lo convierte
        formData.append('bedrooms', bedrooms); // Se envía como string
        formData.append('bathrooms', bathrooms); // Se envía como string
        formData.append('description', description);
        
        if (imageFile) {
            formData.append('image', imageFile); // Adjuntar el archivo de imagen
        } else {
            // Esto es crucial para el modo PUT: Si no hay un nuevo archivo,
            // pero el usuario activó el input de archivo (y lo dejó vacío),
            // necesitamos que el backend sepa que la imagen "no se cambió" en el sentido de que no hay nuevo archivo.
            // O si estamos en modo edición y el usuario "borró" la imagen.
            // El campo hidden `image_url_unchanged` nos ayuda a comunicar esto.
            // Si no hay archivo y el input oculto dice que no se cambió (es decir, el campo de archivo no fue tocado),
            // no enviamos el campo 'image' en el FormData.
            // Si image_url_unchanged es false, significa que el usuario interactuó y no seleccionó archivo,
            // lo que podría indicar que quiere la imagen por defecto.
            formData.append('image_url_unchanged', imageUrlUnchangedInput.value);
        }

        const editingId = publishForm.getAttribute('data-editing-id');
        let url = `${API_BASE_URL}/api/departments`; // Uses the new API_BASE_URL
        let method = 'POST';
        let successMessage = '';

        if (editingId) {
            url = `${API_BASE_URL}/api/departments/${editingId}`; // Uses the new API_BASE_URL
            method = 'PUT';
            successMessage = '¡Departamento actualizado con éxito!';
        } else {
            successMessage = '¡Departamento publicado con éxito!';
        }

        try {
            const response = await fetch(url, {
                method: method,
                // ¡IMPORTANTE! No necesitamos 'Content-Type' al usar FormData,
                // el navegador lo establece automáticamente (multipart/form-data)
                // headers: { 'Content-Type': 'application/json' }, // <-- REMOVIDO
                body: formData // Enviar el objeto FormData
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error del backend:", errorData);

                // Si hay errores específicos de campo del backend, mostrarlos
                if (errorData.errors) {
                    if (errorData.errors.title) showValidationError('title', errorData.errors.title);
                    if (errorData.errors.location) showValidationError('location', errorData.errors.location);
                    if (errorData.errors.contact) showValidationError('contact', errorData.errors.contact);
                    if (errorData.errors.price) showValidationError('price', errorData.errors.price);
                    if (errorData.errors.bedrooms) showValidationError('bedrooms', errorData.errors.bedrooms);
                    if (errorData.errors.bathrooms) showValidationError('bathrooms', errorData.errors.bathrooms);
                    if (errorData.errors.description) showValidationError('description', errorData.errors.description);
                    if (errorData.errors.image) showValidationError('image_upload', errorData.errors.image); // Error de imagen
                }
                showToast(errorData.message || 'Error al procesar el departamento. Por favor, inténtalo de nuevo.', 'error');
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(successMessage, data);
            modalPublish.style.display = 'none';
            publishForm.reset();
            publishForm.removeAttribute('data-editing-id');
            modalTitle.textContent = 'Publicar Nuevo Departamento';
            // Restablecer la vista previa y el input de archivo
            imagePreview.src = 'https://placehold.co/300x200/cccccc/FFFFFF?text=Sin+Imagen';
            imageUploadInput.value = '';
            imageUrlUnchangedInput.value = 'true';

            showToast(successMessage, 'success');
            fetchDepartments(searchInput.value); // Recarga la lista, manteniendo la consulta de búsqueda
        } catch (error) {
            console.error('Error general al procesar el departamento (puede ser de red):', error);
            if (!error.message.includes('HTTP error!') && !error.message.includes('No se recibieron datos')) {
                showToast('Hubo un error de conexión o un problema inesperado. Intenta de nuevo.', 'error');
            }
        }
    });

    // --- Event Listeners para la búsqueda ---
    searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            searchButton.click();
        }
    });

    searchButton.addEventListener('click', () => {
        const query = searchInput.value;
        fetchDepartments(query);
    });

    clearSearchButton.addEventListener('click', () => {
        searchInput.value = '';
        fetchDepartments();
    });

}); // Cierre de document.addEventListener('DOMContentLoaded', ...)