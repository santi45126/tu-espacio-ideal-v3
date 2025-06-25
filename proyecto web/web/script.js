// ** Importante: Asegúrate de que las instancias de Firebase (db, auth, storage, collection, etc.)
//     estén disponibles globalmente, como lo definimos en el <script type="module"> en tu index.html. **

// NO SE USA MAS const API_URL_COLLECTION = 'https://685c5401769de2bf085c6ec6.mockapi.io/departamentos'; // ¡Esta línea ya no es necesaria!

const departmentGrid = document.querySelector('.department-grid');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const clearSearchButton = document.getElementById('clear-search-button');
const publishButton = document.getElementById('publish-button');
const minBedroomsSelect = document.getElementById('min-bedrooms');
const minPriceInput = document.getElementById('min-price');
const maxPriceInput = document.getElementById('max-price');
const sortBySelect = document.getElementById('sort-by');
const modalPublish = document.getElementById('modal-publish');
const modalDetails = document.getElementById('modal-details');
const closeButtons = document.querySelectorAll('.close-button');
const publishForm = document.getElementById('publish-form');
const modalPublishTitle = document.getElementById('modal-publish-title');
const imageUpload = document.getElementById('image_upload');
const imagePreview = document.getElementById('image-preview');
const imageUrlUnchanged = document.getElementById('image-url-unchanged');
const contactToggleButton = document.querySelector('.contact-toggle-button');
const contactFormContainer = document.getElementById('contact-form-container');
const contactForm = document.getElementById('contact-form');
const paginationControls = document.getElementById('pagination-controls');
const userActionButton = document.getElementById('user-action-button');
const modalAuth = document.getElementById('modal-auth');
const authForm = document.getElementById('auth-form');
const authToggleLink = document.getElementById('auth-toggle-link');
const authTitle = document.getElementById('auth-title');
const authNameGroup = document.getElementById('auth-name-group');
const logoutButton = document.getElementById('logout-button');
const userNameDisplay = document.getElementById('user-name-display');
const userEmailDisplay = document.getElementById('user-email-display');

let currentPage = 1;
const itemsPerPage = 6;
let totalDepartmentsCount = 0;
let allDepartments = [];
let editingDepartmentId = null;
let currentSearchTerm = '';
let currentUser = null;

// --- Funciones de Utilidad ---
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.classList.add('toast', type);
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

imageUpload.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            imageUrlUnchanged.value = 'false';
        };
        reader.readAsDataURL(file);
    } else {
        imagePreview.src = 'https://placehold.co/300x200/cccccc/FFFFFF?text=Sin+Imagen';
        imageUrlUnchanged.value = 'true';
    }
});

function openModal(modalElement) {
    modalElement.style.display = 'block';
    setTimeout(() => modalElement.classList.add('show'), 10);
}

function closeModal(modalElement) {
    modalElement.classList.remove('show');
    setTimeout(() => modalElement.style.display = 'none', 300);
    if (modalElement === modalDetails) {
        contactFormContainer.style.display = 'none';
        contactForm.reset();
    }
}

closeButtons.forEach(button => {
    button.addEventListener('click', () => {
        closeModal(modalPublish);
        closeModal(modalDetails);
        closeModal(modalAuth);
    });
});

window.addEventListener('click', e => {
    if (e.target === modalPublish) {
        closeModal(modalPublish);
    }
    if (e.target === modalDetails) {
        closeModal(modalDetails);
    }
    if (e.target === modalAuth) {
        closeModal(modalAuth);
    }
});

// --- Funciones de Firebase Firestore (Base de Datos) ---

/**
 * Carga los departamentos desde Firestore.
 * @param {number} page Página actual a cargar.
 * @param {boolean} userOnly Si es true, filtra por departamentos del usuario actual.
 */
async function loadDepartments(page = 1, userOnly = false) {
    currentPage = page;
    try {
        const departmentsRef = window.collection(window.db, 'departamentos');
        let q;

        if (userOnly && currentUser && currentUser.uid) {
            q = window.query(departmentsRef, window.where('userId', '==', currentUser.uid));
        } else {
            q = departmentsRef;
        }

        const querySnapshot = await window.getDocs(q);
        const fetchedDepartments = [];
        querySnapshot.forEach((doc) => {
            fetchedDepartments.push({ id: doc.id, ...doc.data() });
        });

        totalDepartmentsCount = fetchedDepartments.length;
        allDepartments = fetchedDepartments;

        filterAndSortDepartments(userOnly);

    } catch (e) {
        console.error('Error al cargar los departamentos desde Firebase:', e);
        showToast('Error al cargar departamentos. Intente de nuevo más tarde.', 'error');
    }
}

function highlightText(text, term) {
    if (!term || text === null || text === undefined) return text;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

function displayDepartments(departmentsToDisplay) {
    departmentGrid.innerHTML = '';
    if (departmentsToDisplay.length === 0) {
        departmentGrid.innerHTML = '<p>No se encontraron departamentos que coincidan con la búsqueda.</p>';
    }
    departmentsToDisplay.forEach(dep => {
        const card = document.createElement('div');
        card.classList.add('department-card');
        const highlightedTitle = highlightText(dep.title, currentSearchTerm);
        const highlightedLocation = highlightText(dep.location, currentSearchTerm);
        const highlightedDescription = highlightText(dep.description, currentSearchTerm);
        card.innerHTML = `
            <img src="${dep.image_url || 'https://placehold.co/300x200/cccccc/FFFFFF?text=Imagen+No+Disponible'}" alt="Imagen del departamento en ${dep.location || 'Desconocida'}" onerror="this.onerror=null;this.src='https://placehold.co/300x200/cccccc/FFFFFF?text=Error+al+cargar+imagen';" loading="lazy">
            <h3>${highlightedTitle || 'Departamento sin título'}</h3>
            <p><strong>Ubicación:</strong> ${highlightedLocation || 'Desconocida'}</p>
            <p><strong>Precio:</strong> $${(dep.price || 0).toLocaleString('es-AR')}</p>
            <p><strong>Habitaciones:</strong> ${dep.bedrooms || 'N/A'}</p>
            <p><strong>Baños:</strong> ${dep.bathrooms || 'N/A'}</p>
            <p><strong>Descripción:</strong> ${highlightedDescription || 'Sin descripción.'}</p>
            <button class="details-button" data-id="${dep.id}">Ver Detalles</button>
            ${currentUser && dep.userId === currentUser.uid ?
                `<button class="edit-button" data-id="${dep.id}">Editar</button>
                 <button class="delete-button" data-id="${dep.id}">Eliminar</button>` : ''}
        `;
        departmentGrid.appendChild(card);
    });
    document.querySelectorAll('.details-button').forEach(button => {
        button.addEventListener('click', e => showDepartmentDetails(e.target.dataset.id));
    });
    document.querySelectorAll('.edit-button').forEach(button => {
        button.addEventListener('click', e => editDepartment(e.target.dataset.id));
    });
    document.querySelectorAll('.delete-button').forEach(button => {
        button.addEventListener('click', e => deleteDepartment(e.target.dataset.id));
    });

    renderPaginationControls();
}

function showDepartmentDetails(id) {
    const department = allDepartments.find(dep => dep.id === id);
    if (department) {
        document.getElementById('department-title').textContent = department.title || 'Detalles del Departamento';
        document.getElementById('department-image').src = department.image_url || 'https://placehold.co/300x200/cccccc/FFFFFF?text=Imagen+No+Disponible';
        document.getElementById('department-image').alt = `Imagen del departamento en ${department.location || 'Desconocida'}`;
        document.getElementById('department-location').textContent = department.location || 'Desconocida';
        document.getElementById('department-price').textContent = (department.price || 0).toLocaleString('es-AR');
        document.getElementById('department-bedrooms').textContent = department.bedrooms || 'N/A';
        document.getElementById('department-bathrooms').textContent = department.bathrooms || 'N/A';
        document.getElementById('department-description').textContent = department.description || 'Sin descripción.';
        contactFormContainer.style.display = 'none';
        contactForm.reset();
        openModal(modalDetails);
    }
}

publishButton.addEventListener('click', () => {
    if (!currentUser) {
        showToast('Necesitas iniciar sesión para publicar un departamento.', 'info');
        openModal(modalAuth);
        authTitle.textContent = 'Inicia Sesión o Regístrate para Publicar';
        authNameGroup.style.display = 'none';
        authForm.dataset.mode = 'login';
        authToggleLink.textContent = '¿No tienes una cuenta? Regístrate aquí.';
        return;
    }
    modalPublishTitle.textContent = 'Publicar Nuevo Departamento';
    publishForm.reset();
    imagePreview.src = 'https://placehold.co/300x200/cccccc/FFFFFF?text=Sin+Imagen';
    imageUrlUnchanged.value = 'true';
    editingDepartmentId = null;
    openModal(modalPublish);
});

/**
 * Guarda o actualiza un departamento en Firestore, incluyendo la subida de imagen a Storage.
 * @param {object} departmentData Datos del departamento.
 * @param {File | null} imageFile Archivo de imagen a subir, o null si no hay nuevo archivo.
 */
async function saveDepartment(departmentData, imageFile) {
    if (!currentUser) {
        showToast('Debes iniciar sesión para publicar/editar un departamento.', 'error');
        return;
    }

    departmentData.userId = currentUser.uid;

    try {
        if (imageFile) {
            const storageRef = window.ref(window.storage, `images/departments/${Date.now()}_${imageFile.name}`);
            const uploadTask = await window.uploadBytes(storageRef, imageFile);
            departmentData.image_url = await window.getDownloadURL(uploadTask.ref);
        } else if (editingDepartmentId && imageUrlUnchanged.value === 'true') {
            const existingDepartment = allDepartments.find(dep => dep.id === editingDepartmentId);
            departmentData.image_url = existingDepartment ? existingDepartment.image_url : null;
        } else {
            departmentData.image_url = null;
        }

        if (editingDepartmentId) {
            const depRef = window.doc(window.db, 'departamentos', editingDepartmentId);
            await window.updateDoc(depRef, departmentData);
            showToast('Departamento actualizado con éxito.');
        } else {
            await window.addDoc(window.collection(window.db, 'departamentos'), departmentData);
            showToast('Departamento publicado con éxito.');
        }
        closeModal(modalPublish);
        loadDepartments(currentPage, userActionButton.dataset.view === 'my-listings');
    } catch (e) {
        console.error('Error al guardar el departamento en Firebase:', e);
        showToast('Error al guardar el departamento. Intente de nuevo.', 'error');
    }
}

async function deleteDepartment(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este departamento?')) {
        return;
    }
    if (!currentUser) {
        showToast('Necesitas iniciar sesión para eliminar departamentos.', 'error');
        return;
    }

    try {
        const departmentRef = window.doc(window.db, 'departamentos', id);
        const departmentToDelete = allDepartments.find(dep => dep.id === id);
        if (departmentToDelete && departmentToDelete.userId !== currentUser.uid) {
            showToast('No tienes permiso para eliminar este departamento.', 'error');
            return;
        }

        await window.deleteDoc(departmentRef);
        showToast('Departamento eliminado con éxito.', 'info');
        loadDepartments(currentPage, userActionButton.dataset.view === 'my-listings');
    } catch (e) {
        console.error('Error al eliminar el departamento de Firebase:', e);
        showToast('Error al eliminar el departamento.','error');
    }
}

async function editDepartment(id) {
    const department = allDepartments.find(dep => dep.id === id);
    if (department) {
        if (!currentUser || department.userId !== currentUser.uid) {
            showToast('No tienes permiso para editar este departamento.', 'error');
            return;
        }
        modalPublishTitle.textContent = 'Editar Departamento';
        document.getElementById('title').value = department.title || '';
        document.getElementById('location').value = department.location || '';
        document.getElementById('contact').value = department.contact || '';
        document.getElementById('price').value = department.price || '';
        document.getElementById('bedrooms').value = department.bedrooms || '';
        document.getElementById('bathrooms').value = department.bathrooms || '';
        document.getElementById('description').value = department.description || '';
        imagePreview.src = department.image_url || 'https://placehold.co/300x200/cccccc/FFFFFF?text=Sin+Imagen';
        imageUrlUnchanged.value = 'true';
        editingDepartmentId = id;
        openModal(modalPublish);
    }
}

// --- Lógica de Filtrado y Ordenamiento (se aplica sobre los datos cargados) ---
function filterAndSortDepartments(userOnly = false) {
    currentSearchTerm = searchInput.value.toLowerCase().trim();
    const searchTerm = currentSearchTerm;
    const minBedrooms = parseInt(minBedroomsSelect.value);
    const minPrice = parseFloat(minPriceInput.value);
    const maxPrice = parseFloat(maxPriceInput.value);

    let filteredDepartments = allDepartments.filter(dep => {
        const isMatch = searchTerm === '' ||
                                (dep.title && dep.title.toLowerCase().includes(searchTerm)) ||
                                (dep.location && dep.location.toLowerCase().includes(searchTerm)) ||
                                (dep.description && dep.description.toLowerCase().includes(searchTerm));
        const hasMinBedrooms = minBedrooms === 0 || (dep.bedrooms && dep.bedrooms >= minBedrooms);
        const priceMin = isNaN(minPrice) || (dep.price && dep.price >= minPrice);
        const priceMax = isNaN(maxPrice) || (dep.price && dep.price <= maxPrice);

        const isUserListing = userOnly ? (dep.userId === (currentUser ? currentUser.uid : null)) : true;

        return isMatch && hasMinBedrooms && priceMin && priceMax && isUserListing;
    });

    const sortBy = sortBySelect.value;
    if (sortBy !== 'none') {
        filteredDepartments.sort((a, b) => {
            let valA, valB;
            if (sortBy.includes('price')) {
                valA = a.price || 0;
                valB = b.price || 0;
            } else if (sortBy.includes('bedrooms')) {
                valA = a.bedrooms || 0;
                valB = b.bedrooms || 0;
            }
            if (sortBy.endsWith('asc')) {
                return valA - valB;
            } else {
                return valB - valA;
            }
        });
    }

    displayDepartments(filteredDepartments);
}

// --- Event Listeners para Filtros y Búsqueda ---
searchButton.addEventListener('click', () => {
    currentPage = 1;
    loadDepartments(currentPage, userActionButton.dataset.view === 'my-listings');
});
searchInput.addEventListener('keyup', e => {
    if ('Enter' === e.key) {
        currentPage = 1;
        loadDepartments(currentPage, userActionButton.dataset.view === 'my-listings');
    }
});
minBedroomsSelect.addEventListener('change', () => {
    currentPage = 1;
    loadDepartments(currentPage, userActionButton.dataset.view === 'my-listings');
});
minPriceInput.addEventListener('input', () => {
    currentPage = 1;
    loadDepartments(currentPage, userActionButton.dataset.view === 'my-listings');
});
maxPriceInput.addEventListener('input', () => {
    currentPage = 1;
    loadDepartments(currentPage, userActionButton.dataset.view === 'my-listings');
});
sortBySelect.addEventListener('change', () => {
    filterAndSortDepartments(userActionButton.dataset.view === 'my-listings');
});

clearSearchButton.addEventListener('click', () => {
    searchInput.value = '';
    minBedroomsSelect.value = '0';
    minPriceInput.value = '';
    maxPriceInput.value = '';
    sortBySelect.value = 'none';
    currentSearchTerm = '';
    currentPage = 1;
    loadDepartments(currentPage, userActionButton.dataset.view === 'my-listings');
});

// --- Manejo del Formulario de Publicación ---
publishForm.addEventListener('submit', async e => {
    e.preventDefault();
    const formData = new FormData(publishForm);
    const departmentData = {
        title: formData.get('title'),
        location: formData.get('location'),
        contact: formData.get('contact'),
        price: parseFloat(formData.get('price')),
        bedrooms: parseInt(formData.get('bedrooms')),
        bathrooms: parseFloat(formData.get('bathrooms')),
        description: formData.get('description'),
        createdAt: new Date()
    };

    // Validaciones
    if (!departmentData.title || departmentData.title.trim() === '') { showToast('El título es obligatorio.', 'error'); return; }
    if (!departmentData.location || departmentData.location.trim() === '') { showToast('La ubicación es obligatoria.', 'error'); return; }
    if (!departmentData.contact || departmentData.contact.trim() === '') { showToast('El contacto es obligatorio.', 'error'); return; }
    if (isNaN(departmentData.price) || departmentData.price <= 0) { showToast('El precio debe ser un número positivo.', 'error'); return; }
    if (isNaN(departmentData.bedrooms) || departmentData.bedrooms <= 0 || !Number.isInteger(departmentData.bedrooms)) { showToast('Las habitaciones deben ser un número entero positivo.', 'error'); return; }
    if (isNaN(departmentData.bathrooms) || departmentData.bathrooms <= 0) { showToast('Los baños deben ser un número positivo.', 'error'); return; }
    const contactRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$|^[0-9\s\-\(\)\+]{7,}$/;
    if (!contactRegex.test(departmentData.contact)) { showToast('Formato de contacto inválido. Ingrese un email o un número de teléfono válido (mín. 7 dígitos).', 'error'); return; }

    const imageFile = imageUpload.files.length > 0 && imageUrlUnchanged.value === 'false' ? imageUpload.files[0] : null;

    await saveDepartment(departmentData, imageFile);
});

// --- Contact Form Logic ---
contactToggleButton.addEventListener('click', () => {
    contactFormContainer.style.display = contactFormContainer.style.display === 'none' ? 'block' : 'none';
});

contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inquirerName = document.getElementById('inquirer-name').value.trim();
    const inquirerEmail = document.getElementById('inquirer-email').value.trim();
    const inquirerPhone = document.getElementById('inquirer-phone').value.trim();
    const inquirerMessage = document.getElementById('inquirer-message').value.trim();

    if (!inquirerName) { showToast('Por favor, ingresa tu nombre.', 'error'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!inquirerEmail || !emailRegex.test(inquirerEmail)) { showToast('Por favor, ingresa un email válido.', 'error'); return; }
    if (!inquirerMessage) { showToast('El mensaje no puede estar vacío.', 'error'); return; }

    showToast('Consulta enviada con éxito. El publicador se contactará pronto.', 'success');
    console.log('Consulta enviada:', {
        departmentTitle: document.getElementById('department-title').textContent,
        inquirerName,
        inquirerEmail,
        inquirerPhone,
        inquirerMessage
    });
    contactForm.reset();
    contactFormContainer.style.display = 'none';
});

// --- Paginación (Adaptada para datos cargados) ---
function renderPaginationControls() {
    const totalPages = Math.ceil(totalDepartmentsCount / itemsPerPage);
    paginationControls.innerHTML = '';

    if (allDepartments.length === 0 && (currentSearchTerm === '' || (currentUser && userActionButton.dataset.view === 'my-listings'))) {
        paginationControls.style.display = 'none';
        return;
    }

    paginationControls.style.display = 'flex';

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Anterior';
    prevButton.classList.add('pagination-button');
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => goToPage(currentPage - 1));
    paginationControls.appendChild(prevButton);

    const maxPageNumbersToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPageNumbersToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPageNumbersToShow - 1);

    if (endPage - startPage + 1 < maxPageNumbersToShow) {
        startPage = Math.max(1, endPage - maxPageNumbersToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.classList.add('pagination-button');
        if (i === currentPage) {
            pageButton.classList.add('active');
        }
        pageButton.addEventListener('click', () => goToPage(i));
        paginationControls.appendChild(pageButton);
    }

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Siguiente';
    nextButton.classList.add('pagination-button');
    nextButton.disabled = currentPage === totalPages || totalPages === 0;
    nextButton.addEventListener('click', () => goToPage(currentPage + 1));
    paginationControls.appendChild(nextButton);
}

function goToPage(page) {
    const userOnly = currentUser && userActionButton.dataset.view === 'my-listings';
    currentPage = page;
    loadDepartments(currentPage, userOnly);
}

// --- Autenticación con Firebase Auth ---
window.onAuthStateChanged(window.auth, (user) => {
    currentUser = user;
    updateUserUI();
    loadDepartments(currentPage, userActionButton.dataset.view === 'my-listings');
});

function updateUserUI() {
    if (currentUser) {
        userActionButton.textContent = `Hola, ${currentUser.displayName || currentUser.email} (Mis Publicaciones)`;
        userNameDisplay.textContent = currentUser.displayName || '';
        userEmailDisplay.textContent = currentUser.email || '';
        publishButton.style.display = 'block';
        logoutButton.style.display = 'block';
    } else {
        userActionButton.textContent = 'Iniciar Sesión / Registrarse';
        userNameDisplay.textContent = '';
        userEmailDisplay.textContent = '';
        publishButton.style.display = 'none';
        logoutButton.style.display = 'none';
    }
    if (!currentUser && userActionButton.dataset.view === 'my-listings') {
        userActionButton.dataset.view = 'all';
    }
}

userActionButton.addEventListener('click', () => {
    if (currentUser) {
        if (userActionButton.dataset.view === 'all') {
            userActionButton.dataset.view = 'my-listings';
            userActionButton.textContent = `Hola, ${currentUser.displayName || currentUser.email} (Todas las Publicaciones)`;
            loadDepartments(1, true);
        } else {
            userActionButton.dataset.view = 'all';
            userActionButton.textContent = `Hola, ${currentUser.displayName || currentUser.email} (Mis Publicaciones)`;
            loadDepartments(1, false);
        }
    } else {
        authTitle.textContent = 'Inicia Sesión o Regístrate';
        authNameGroup.style.display = 'block';
        authForm.dataset.mode = 'register';
        authToggleLink.textContent = '¿Ya tienes una cuenta? Inicia Sesión aquí.';
        openModal(modalAuth);
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const name = document.getElementById('auth-name').value.trim();
    const mode = authForm.dataset.mode;

    if (!email || !password) {
        showToast('El email y la contraseña son obligatorios.', 'error');
        return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Por favor, ingresa un email válido.', 'error');
        return;
    }
    if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
        return;
    }

    try {
        if (mode === 'register') {
            if (!name) {
                showToast('El nombre es obligatorio para registrarse.', 'error');
                return;
            }
            const userCredential = await window.createUserWithEmailAndPassword(window.auth, email, password);
            await window.updateProfile(userCredential.user, { displayName: name });
            showToast(`Bienvenido, ${name}! Te has registrado exitosamente.`, 'success');
        } else {
            await window.signInWithEmailAndPassword(window.auth, email, password);
            showToast(`Bienvenido de nuevo!`, 'success');
        }
        closeModal(modalAuth);
    } catch (error) {
        console.error('Error de autenticación:', error.code, error.message);
        let errorMessage = 'Error de autenticación. Intente de nuevo.';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Este email ya está registrado.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Email inválido.';
        } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = 'Email o contraseña incorrectos.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'La contraseña es demasiado débil (mínimo 6 caracteres).';
        }
        showToast(errorMessage, 'error');
    }
});

authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (authForm.dataset.mode === 'register') {
        authForm.dataset.mode = 'login';
        authTitle.textContent = 'Iniciar Sesión';
        authNameGroup.style.display = 'none';
        authToggleLink.textContent = '¿No tienes una cuenta? Regístrate aquí.';
    } else {
        authForm.dataset.mode = 'register';
        authTitle.textContent = 'Registrarse';
        authNameGroup.style.display = 'block';
        authToggleLink.textContent = '¿Ya tienes una cuenta? Inicia Sesión aquí.';
    }
    authForm.reset();
});

function logout() {
    window.signOut(window.auth).then(() => {
        showToast('Sesión cerrada correctamente.', 'info');
    }).catch((error) => {
        console.error('Error al cerrar sesión:', error);
        showToast('Error al cerrar sesión.', 'error');
    });
}
logoutButton.addEventListener('click', logout);