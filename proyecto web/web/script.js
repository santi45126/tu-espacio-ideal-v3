// URLs de la API (asegúrate de que estas sean las correctas)
const API_BASE_URL = 'https://667b2184bd04576b61ee483c.mockapi.io';
const API_ENDPOINT = '/departments';

// Elementos del DOM
const departmentGrid = document.querySelector('.department-grid');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const clearSearchButton = document.getElementById('clear-search-button');
const publishButton = document.getElementById('publish-button');

// Nuevos elementos para los filtros
const minBedroomsSelect = document.getElementById('min-bedrooms');
const minPriceInput = document.getElementById('min-price');
const maxPriceInput = document.getElementById('max-price');

const modalPublish = document.getElementById('modal-publish');
const modalDetails = document.getElementById('modal-details');
const closeButtons = document.querySelectorAll('.close-button');
const publishForm = document.getElementById('publish-form');
const modalPublishTitle = document.getElementById('modal-publish-title');
const imageUpload = document.getElementById('image_upload');
const imagePreview = document.getElementById('image-preview');
const imageUrlUnchanged = document.getElementById('image_url_unchanged');

let allDepartments = []; // Almacenar todos los departamentos cargados
let editingDepartmentId = null; // Para saber si estamos editando o publicando uno nuevo

// --- Funciones de Utilidad ---

// Mostrar notificaciones Toast
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.classList.add('toast', type);
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // Eliminar el toast después de unos segundos
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Cargar imagen de vista previa
imageUpload.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            imageUrlUnchanged.value = 'false'; // Indica que la imagen ha cambiado
        };
        reader.readAsDataURL(file);
    } else {
        imagePreview.src = 'https://placehold.co/300x200/cccccc/FFFFFF?text=Sin+Imagen';
        imageUrlUnchanged.value = 'true'; // Indica que la imagen no ha cambiado
    }
});


// --- Funciones para Modales ---

function openModal(modal) {
    modal.style.display = 'block';
    setTimeout(() => modal.classList.add('show'), 10); // Añadir clase 'show' para la transición
}

function closeModal(modal) {
    modal.classList.remove('show'); // Quitar clase 'show' para la transición
    setTimeout(() => modal.style.display = 'none', 300); // Esconder después de la transición
}

closeButtons.forEach(button => {
    button.addEventListener('click', () => {
        closeModal(modalPublish);
        closeModal(modalDetails);
    });
});

window.addEventListener('click', (event) => {
    if (event.target === modalPublish) {
        closeModal(modalPublish);
    }
    if (event.target === modalDetails) {
        closeModal(modalDetails);
    }
});


// --- Funciones CRUD (Create, Read, Update, Delete) ---

// READ: Cargar y mostrar departamentos
async function loadDepartments() {
    try {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINT}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allDepartments = await response.json();
        displayDepartments(allDepartments);
    } catch (error) {
        console.error("Error al cargar los departamentos:", error);
        showToast('Error al cargar departamentos.', 'error');
    }
}

// Mostrar departamentos en el DOM (ahora llama a filterDepartments)
function displayDepartments(departments) {
    departmentGrid.innerHTML = ''; // Limpiar el grid antes de mostrar
    if (departments.length === 0) {
        departmentGrid.innerHTML = '<p>No se encontraron departamentos que coincidan con la búsqueda.</p>';
        return;
    }
    departments.forEach(department => {
        const departmentCard = document.createElement('div');
        departmentCard.classList.add('department-card');
        departmentCard.innerHTML = `
            <img src="${department.image_url || 'https://placehold.co/300x200/cccccc/FFFFFF?text=Imagen+No+Disponible'}" alt="Imagen del departamento en ${department.location || 'Chimbas'}" onerror="this.onerror=null;this.src='https://placehold.co/300x200/cccccc/FFFFFF?text=Error+al+cargar+imagen';" loading="lazy">
            <h3>${department.title || 'Departamento sin título'}</h3>
            <p><strong>Ubicación:</strong> ${department.location || 'Desconocida'}</p>
            <p><strong>Precio:</strong> $${(department.price || 0).toLocaleString('es-AR')}</p>
            <p><strong>Habitaciones:</strong> ${department.bedrooms || 'N/A'}</p>
            <p><strong>Baños:</strong> ${department.bathrooms || 'N/A'}</p>
            <button class="details-button" data-id="${department.id}">Ver Detalles</button>
            <button class="edit-button" data-id="${department.id}">Editar</button>
            <button class="delete-button" data-id="${department.id}">Eliminar</button>
        `;
        departmentGrid.appendChild(departmentCard);
    });

    // AñadirEventListeners a los botones de la tarjeta
    document.querySelectorAll('.details-button').forEach(button => {
        button.addEventListener('click', (e) => showDepartmentDetails(e.target.dataset.id));
    });
    document.querySelectorAll('.edit-button').forEach(button => {
        button.addEventListener('click', (e) => editDepartment(e.target.dataset.id));
    });
    document.querySelectorAll('.delete-button').forEach(button => {
        button.addEventListener('click', (e) => deleteDepartment(e.target.dataset.id));
    });
}

// Función para mostrar los detalles del departamento en un modal
function showDepartmentDetails(id) {
    const department = allDepartments.find(dep => dep.id === id);
    if (department) {
        document.getElementById('department-title').textContent = department.title || 'Detalles del Departamento';
        document.getElementById('department-image').src = department.image_url || 'https://placehold.co/300x200/cccccc/FFFFFF?text=Imagen+No+Disponible';
        document.getElementById('department-image').alt = `Imagen del departamento en ${department.location || 'Chimbas'}`; // Alt text para el modal
        document.getElementById('department-location').textContent = department.location || 'Desconocida';
        document.getElementById('department-price').textContent = (department.price || 0).toLocaleString('es-AR');
        document.getElementById('department-bedrooms').textContent = department.bedrooms || 'N/A';
        document.getElementById('department-bathrooms').textContent = department.bathrooms || 'N/A';
        document.getElementById('department-description').textContent = department.description || 'Sin descripción.';
        document.getElementById('department-contact').textContent = department.contact || 'No especificado.';
        openModal(modalDetails);
    }
}


// CREATE/UPDATE: Publicar o Editar departamento
publishButton.addEventListener('click', () => {
    modalPublishTitle.textContent = 'Publicar Nuevo Departamento';
    publishForm.reset(); // Limpiar formulario
    imagePreview.src = 'https://placehold.co/300x200/cccccc/FFFFFF?text=Sin+Imagen'; // Restablecer vista previa
    imageUrlUnchanged.value = 'true'; // Resetear estado de imagen
    editingDepartmentId = null; // No estamos editando
    openModal(modalPublish);
});

async function saveDepartment(departmentData) {
    let url = `${API_BASE_URL}${API_ENDPOINT}`;
    let method = 'POST';

    if (editingDepartmentId) {
        url += `/${editingDepartmentId}`;
        method = 'PUT';
    }

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(departmentData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        showToast(editingDepartmentId ? 'Departamento actualizado con éxito.' : 'Departamento publicado con éxito.');
        closeModal(modalPublish);
        loadDepartments(); // Recargar la lista
    } catch (error) {
        console.error("Error al guardar el departamento:", error);
        showToast('Error al guardar el departamento.', 'error');
    }
}

// DELETE: Eliminar departamento
async function deleteDepartment(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este departamento?')) {
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINT}/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        showToast('Departamento eliminado con éxito.', 'info');
        loadDepartments(); // Recargar la lista
    } catch (error) {
        console.error("Error al eliminar el departamento:", error);
        showToast('Error al eliminar el departamento.', 'error');
    }
}

// EDIT: Cargar datos para edición
async function editDepartment(id) {
    const department = allDepartments.find(dep => dep.id === id);
    if (department) {
        modalPublishTitle.textContent = 'Editar Departamento';
        document.getElementById('title').value = department.title || '';
        document.getElementById('location').value = department.location || '';
        document.getElementById('contact').value = department.contact || '';
        document.getElementById('price').value = department.price || '';
        document.getElementById('bedrooms').value = department.bedrooms || '';
        document.getElementById('bathrooms').value = department.bathrooms || '';
        document.getElementById('description').value = department.description || '';
        imagePreview.src = department.image_url || 'https://placehold.co/300x200/cccccc/FFFFFF?text=Sin+Imagen';
        imageUrlUnchanged.value = 'true'; // Al editar, asumimos que la imagen no ha cambiado hasta que el usuario suba una nueva
        
        editingDepartmentId = id;
        openModal(modalPublish);
    }
}

// --- Lógica de Filtros y Búsqueda ---

// Función principal para filtrar departamentos
function filterDepartments() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const minBedrooms = parseInt(minBedroomsSelect.value); // Obtener valor del selector de habitaciones
    const minPrice = parseFloat(minPriceInput.value); // Obtener valor del input de precio mínimo
    const maxPrice = parseFloat(maxPriceInput.value); // Obtener valor del input de precio máximo

    const filtered = allDepartments.filter(department => {
        const matchesSearch = searchTerm === '' ||
            (department.title && department.title.toLowerCase().includes(searchTerm)) ||
            (department.location && department.location.toLowerCase().includes(searchTerm)) ||
            (department.description && department.description.toLowerCase().includes(searchTerm));

        // Filtrado por habitaciones (si el departamento tiene menos habitaciones que el mínimo seleccionado, se filtra)
        const matchesBedrooms = minBedrooms === 0 || (department.bedrooms && department.bedrooms >= minBedrooms);

        // Filtrado por precio mínimo
        const matchesMinPrice = isNaN(minPrice) || (department.price && department.price >= minPrice);

        // Filtrado por precio máximo
        const matchesMaxPrice = isNaN(maxPrice) || (department.price && department.price <= maxPrice);

        return matchesSearch && matchesBedrooms && matchesMinPrice && matchesMaxPrice;
    });

    displayDepartments(filtered);
}

// Event Listeners para la búsqueda y los filtros
searchButton.addEventListener('click', filterDepartments);
searchInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        filterDepartments();
    }
});

// Añadidos Event Listeners para los nuevos filtros
minBedroomsSelect.addEventListener('change', filterDepartments);
minPriceInput.addEventListener('input', filterDepartments); // Usar 'input' para filtrar mientras el usuario escribe
maxPriceInput.addEventListener('input', filterDepartments); // Usar 'input' para filtrar mientras el usuario escribe


clearSearchButton.addEventListener('click', () => {
    searchInput.value = '';
    minBedroomsSelect.value = '0'; // Resetear selector de habitaciones
    minPriceInput.value = ''; // Resetear precio mínimo
    maxPriceInput.value = ''; // Resetear precio máximo
    filterDepartments(); // Volver a mostrar todos los departamentos
});

// Manejo del envío del formulario de publicación
publishForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(publishForm);
    const departmentData = {
        title: formData.get('title'),
        location: formData.get('location'),
        contact: formData.get('contact'),
        price: parseFloat(formData.get('price')),
        bedrooms: parseInt(formData.get('bedrooms')),
        bathrooms: parseFloat(formData.get('bathrooms')),
        description: formData.get('description')
    };

    // Manejo de la imagen: solo subir si ha cambiado
    if (imageUpload.files.length > 0 && imageUrlUnchanged.value === 'false') {
        // En un entorno real, aquí enviarías la imagen a un servicio de almacenamiento (Cloudinary, S3, etc.)
        // MockAPI no soporta subida de archivos directamente, así que simularemos la URL.
        // En una app real, la URL de la imagen se obtendría del servicio de almacenamiento.
        departmentData.image_url = 'https://picsum.photos/400/300?' + Math.random(); // URL de imagen de ejemplo
    } else if (editingDepartmentId && imageUrlUnchanged.value === 'true') {
        // Si estamos editando y no se subió una nueva imagen, mantener la URL existente
        const existingDepartment = allDepartments.find(dep => dep.id === editingDepartmentId);
        departmentData.image_url = existingDepartment ? existingDepartment.image_url : null;
    } else {
        // Si no hay imagen y no estamos editando o se borró la imagen
        departmentData.image_url = null;
    }

    await saveDepartment(departmentData);
});

// Cargar departamentos al iniciar la página
document.addEventListener('DOMContentLoaded', loadDepartments);