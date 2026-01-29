/**
 * Admin Panel for Appointments Management
 * Firebase-powered appointment management
 */

(function() {
  'use strict';

  const FIREBASE_CONFIG = window.FIREBASE_CONFIG;
  const CATALOG_KEY = window.CATALOG_KEY;
  const SERVICES = window.SERVICES || [];

  let firebaseApp = null;
  let auth = null;
  let db = null;
  let currentUser = null;
  let currentDate = new Date();
  let editingSlotId = null;
  
  // Configuración de turnos
  let appointmentConfig = {
    mode: 'individual', // 'individual' | 'multi-resource'
    resources: []       // Lista de recursos (empleados/cabinas)
  };
  
  // Filtro de recurso seleccionado
  let selectedResourceFilter = null; // null = todos

  // DOM Elements
  const loadingScreen = document.getElementById('loading-screen');
  const loginScreen = document.getElementById('login-screen');
  const dashboard = document.getElementById('admin-dashboard');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const userEmailEl = document.getElementById('user-email');
  const currentDateEl = document.getElementById('current-date');
  const appointmentsList = document.getElementById('appointments-list');
  const slotModal = document.getElementById('slot-modal');
  const slotForm = document.getElementById('slot-form');

  // Initialize Firebase
  function initFirebase() {
    if (!FIREBASE_CONFIG) {
      console.error('Firebase config not found');
      hideLoading();
      showError('Error de configuración');
      return false;
    }

    try {
      firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
      auth.onAuthStateChanged(handleAuthStateChange);
      console.log('✅ Firebase initialized');
      return true;
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      hideLoading();
      showError('Error al conectar con Firebase');
      return false;
    }
  }

  function hideLoading() {
    if (loadingScreen) loadingScreen.style.display = 'none';
  }

  function handleAuthStateChange(user) {
    currentUser = user;
    hideLoading();
    if (user) {
      loginScreen.style.display = 'none';
      dashboard.style.display = 'block';
      userEmailEl.textContent = user.email;
      loadAppointmentConfig().then(function() {
        loadAppointments();
        loadStats();
      });
    } else {
      loginScreen.style.display = 'flex';
      dashboard.style.display = 'none';
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    const email = loginForm.email.value;
    const password = loginForm.password.value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Iniciando sesión...';
    hideError();

    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      console.error('Login error:', error);
      let message = 'Error al iniciar sesión';
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          message = 'Email o contraseña incorrectos';
          break;
        case 'auth/too-many-requests':
          message = 'Demasiados intentos. Intenta más tarde.';
          break;
        case 'auth/network-request-failed':
          message = 'Error de conexión';
          break;
      }
      showError(message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg> Iniciar Sesión`;
    }
  }

  async function handleLogout() {
    try { await auth.signOut(); } catch (error) { console.error('Logout error:', error); }
  }

  function showError(message) { loginError.textContent = message; loginError.style.display = 'block'; }
  function hideError() { loginError.style.display = 'none'; }

  // Load appointment configuration from Firestore
  async function loadAppointmentConfig() {
    if (!db || !CATALOG_KEY) return;
    try {
      const doc = await db.collection('turnos').doc(CATALOG_KEY).get();
      if (doc.exists && doc.data().config) {
        appointmentConfig = doc.data().config;
        console.log('✅ Appointment config loaded:', appointmentConfig);
      }
      // Mostrar/ocultar filtro de recursos
      updateResourceFilter();
    } catch (error) {
      console.error('Error loading appointment config:', error);
    }
  }
  
  // Actualizar el filtro de recursos en la UI
  function updateResourceFilter() {
    const existingFilter = document.getElementById('resource-filter-container');
    if (existingFilter) existingFilter.remove();
    
    // Solo mostrar si está en modo multi-resource y hay recursos
    if (appointmentConfig.mode !== 'multi-resource' || !appointmentConfig.resources || appointmentConfig.resources.length === 0) {
      console.log('⚠️ Resource filter not shown: mode=' + appointmentConfig.mode + ', resources=' + (appointmentConfig.resources?.length || 0));
      return;
    }
    
    const calendarNav = document.querySelector('.admin-calendar-nav');
    if (!calendarNav) {
      console.log('⚠️ admin-calendar-nav not found');
      return;
    }
    
    let options = '<option value="">👥 Todos</option>';
    appointmentConfig.resources.forEach(r => {
      const selected = selectedResourceFilter === r.id ? 'selected' : '';
      options += `<option value="${r.id}" ${selected}>👤 ${r.name}</option>`;
    });
    
    const filterContainer = document.createElement('div');
    filterContainer.id = 'resource-filter-container';
    filterContainer.style.cssText = 'display:inline-flex;align-items:center;margin-left:1rem;';
    filterContainer.innerHTML = `
      <select id="resource-filter" style="padding:0.5rem 0.75rem;border:2px solid #e0e7ff;border-radius:0.5rem;font-size:0.875rem;font-weight:500;background:white;color:#4338ca;cursor:pointer;">
        ${options}
      </select>
    `;
    
    calendarNav.appendChild(filterContainer);
    console.log('✅ Resource filter added');
    
    document.getElementById('resource-filter').addEventListener('change', (e) => {
      selectedResourceFilter = e.target.value || null;
      loadAppointments();
    });
  }

  async function loadAppointments() {
    if (!db || !CATALOG_KEY) { console.log('⚠️ Missing db or CATALOG_KEY'); return; }
    const dateStr = formatDate(currentDate);
    updateDateDisplay();
    console.log('📅 Loading appointments for:', dateStr, 'catalog:', CATALOG_KEY, 'resource:', selectedResourceFilter);
    appointmentsList.innerHTML = '<div class="loading">Cargando turnos...</div>';

    try {
      let query = db.collection('turnos').doc(CATALOG_KEY).collection('slots').where('date', '==', dateStr);
      
      // Filtrar por recurso si está seleccionado
      if (selectedResourceFilter) {
        query = query.where('resourceId', '==', selectedResourceFilter);
      }
      
      const snapshot = await query.get();
      console.log('📊 Found', snapshot.size, 'slots');

      if (snapshot.empty) {
        const resourceName = selectedResourceFilter 
          ? appointmentConfig.resources?.find(r => r.id === selectedResourceFilter)?.name 
          : null;
        const emptyMsg = resourceName 
          ? `No hay turnos para ${resourceName} este día` 
          : 'No hay turnos para este día';
        appointmentsList.innerHTML = `<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg><p>${emptyMsg}</p></div>`;
        return;
      }

      const slots = [];
      snapshot.forEach(doc => { slots.push({ id: doc.id, ...doc.data() }); });
      slots.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

      let html = '';
      slots.forEach(slot => { html += renderAppointmentItem(slot); });
      appointmentsList.innerHTML = html;

      appointmentsList.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id));
      });
      appointmentsList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteSlot(btn.dataset.id));
      });
    } catch (error) {
      console.error('Error loading appointments:', error);
      appointmentsList.innerHTML = '<div class="empty-state"><p>Error al cargar turnos</p></div>';
    }
  }

  function renderAppointmentItem(slot) {
    const statusLabels = { available: 'Disponible', booked: 'Reservado', blocked: 'Bloqueado', completed: 'Completado', cancelled: 'Cancelado' };
    const resourceBadge = slot.resourceName 
      ? `<span style="background:#e0e7ff;color:#4338ca;padding:0.125rem 0.5rem;border-radius:1rem;font-size:0.6875rem;font-weight:600;margin-left:0.5rem;">👤 ${slot.resourceName}</span>` 
      : '';
    return `<div class="appointment-item" data-id="${slot.id}"><div class="appointment-time">${slot.time}</div><div class="appointment-info"><div class="appointment-service">${slot.serviceName || 'Sin servicio'}${resourceBadge}</div>${slot.clientName ? `<div class="appointment-client">${slot.clientName}${slot.clientPhone ? ` · ${slot.clientPhone}` : ''}</div>` : ''}</div><span class="appointment-status ${slot.status}">${statusLabels[slot.status] || slot.status}</span><div class="appointment-actions"><button class="edit-btn" data-id="${slot.id}" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button><button class="delete-btn delete" data-id="${slot.id}" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div></div>`;
  }

  async function loadStats() {
    if (!db || !CATALOG_KEY) return;
    const today = formatDate(new Date());
    try {
      const allSlotsSnapshot = await db.collection('turnos').doc(CATALOG_KEY).collection('slots').get();
      const allSlots = [];
      allSlotsSnapshot.forEach(doc => { allSlots.push({ id: doc.id, ...doc.data() }); });
      const todayBooked = allSlots.filter(s => s.date === today && s.status === 'booked');
      document.getElementById('stat-today').textContent = todayBooked.length;
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekStartStr = formatDate(weekStart);
      const weekEndStr = formatDate(weekEnd);
      const weekBooked = allSlots.filter(s => s.date >= weekStartStr && s.date <= weekEndStr && s.status === 'booked');
      document.getElementById('stat-week').textContent = weekBooked.length;
      const pendingBooked = allSlots.filter(s => s.date >= today && s.status === 'booked');
      document.getElementById('stat-pending').textContent = pendingBooked.length;
    } catch (error) { console.error('Error loading stats:', error); }
  }

  function navigateDate(delta) { currentDate.setDate(currentDate.getDate() + delta); loadAppointments(); }
  function goToToday() { currentDate = new Date(); loadAppointments(); }

  function updateDateDisplay() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const current = new Date(currentDate); current.setHours(0, 0, 0, 0);
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    let text = currentDate.toLocaleDateString('es-AR', options);
    if (current.getTime() === today.getTime()) text = 'Hoy - ' + text;
    currentDateEl.textContent = text.charAt(0).toUpperCase() + text.slice(1);
  }

  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function openAddModal() {
    editingSlotId = null;
    document.getElementById('slot-modal-title').textContent = 'Agregar Turno';
    slotForm.reset();
    slotModal.style.display = 'flex';
  }

  async function openEditModal(slotId) {
    editingSlotId = slotId;
    document.getElementById('slot-modal-title').textContent = 'Editar Turno';
    try {
      const doc = await db.collection('turnos').doc(CATALOG_KEY).collection('slots').doc(slotId).get();
      if (doc.exists) {
        const data = doc.data();
        slotForm.time.value = data.time || '';
        slotForm.serviceId.value = data.serviceId || '';
        slotForm.clientName.value = data.clientName || '';
        slotForm.clientPhone.value = data.clientPhone || '';
        slotForm.notes.value = data.notes || '';
        slotForm.status.value = data.status || 'available';
      }
      slotModal.style.display = 'flex';
    } catch (error) { console.error('Error loading slot:', error); alert('Error al cargar el turno'); }
  }

  function closeModal() { slotModal.style.display = 'none'; editingSlotId = null; }

  async function handleSlotSubmit(e) {
    e.preventDefault();
    const submitBtn = slotForm.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    const formData = new FormData(slotForm);
    const time = formData.get('time');
    const dateStr = formatDate(currentDate);
    if (!time) { alert('Debes seleccionar un horario'); return; }
    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Guardando...';
    const service = SERVICES.find(s => s.id == formData.get('serviceId'));
    const slotData = {
      date: dateStr, time: time,
      serviceId: formData.get('serviceId') || null,
      serviceName: service?.name || null,
      servicePrice: service?.price || null,
      clientName: formData.get('clientName') || null,
      clientPhone: formData.get('clientPhone') || null,
      notes: formData.get('notes') || null,
      status: formData.get('status'),
      updatedAt: new Date().toISOString()
    };

    try {
      const catalogRef = db.collection('turnos').doc(CATALOG_KEY);
      if (!editingSlotId) {
        const existingSlots = await catalogRef.collection('slots').where('date', '==', dateStr).where('time', '==', time).get();
        if (!existingSlots.empty) {
          alert(`Ya existe un turno a las ${time} para este día`);
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
          return;
        }
      }
      if (editingSlotId) {
        await catalogRef.collection('slots').doc(editingSlotId).update(slotData);
      } else {
        slotData.createdAt = new Date().toISOString();
        const parentDoc = await catalogRef.get();
        if (!parentDoc.exists) {
          await catalogRef.set({ catalogKey: CATALOG_KEY, createdAt: new Date().toISOString() });
        }
        await catalogRef.collection('slots').add(slotData);
      }
      closeModal();
      loadAppointments();
      loadStats();
    } catch (error) {
      console.error('❌ Error saving slot:', error);
      let errorMsg = 'Error al guardar el turno';
      if (error.code === 'permission-denied') errorMsg = 'Sin permisos para guardar.';
      else if (error.code === 'unavailable') errorMsg = 'Firebase no disponible.';
      alert(errorMsg);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }

  async function deleteSlot(slotId) {
    if (!confirm('¿Estás seguro de eliminar este turno?')) return;
    try {
      await db.collection('turnos').doc(CATALOG_KEY).collection('slots').doc(slotId).delete();
      loadAppointments();
      loadStats();
    } catch (error) { console.error('Error deleting slot:', error); alert('Error al eliminar el turno'); }
  }


  // ============================================
  // APPOINTMENT CONFIG MANAGEMENT
  // ============================================
  
  function openConfigModal() {
    const existing = document.getElementById('config-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'config-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;';
    
    let resourcesHtml = '';
    if (appointmentConfig.resources && appointmentConfig.resources.length > 0) {
      resourcesHtml = appointmentConfig.resources.map((r, i) => `
        <div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem;background:#f9fafb;border-radius:0.5rem;margin-bottom:0.5rem;">
          <span style="flex:1;font-weight:500;">${r.name}</span>
          <button type="button" class="remove-resource" data-index="${i}" style="background:#ef4444;color:white;border:none;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:1rem;">×</button>
        </div>
      `).join('');
    } else {
      resourcesHtml = '<p style="color:#6b7280;font-size:0.875rem;text-align:center;padding:1rem;">No hay recursos configurados</p>';
    }

    modal.innerHTML = `
      <div style="background:white;border-radius:1rem;width:100%;max-width:450px;max-height:90vh;overflow:hidden;box-shadow:0 25px 60px -12px rgba(0,0,0,0.4);">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:white;">
          <h3 style="font-size:1.125rem;font-weight:700;margin:0;">⚙️ Configuración de Turnos</h3>
          <button id="config-close" style="background:rgba(255,255,255,0.2);border:none;width:32px;height:32px;border-radius:0.5rem;color:white;font-size:1.5rem;cursor:pointer;">&times;</button>
        </div>
        <div style="padding:1.25rem;overflow-y:auto;max-height:calc(90vh - 70px);">
          <form id="config-form">
            <div style="margin-bottom:1.25rem;">
              <label style="display:block;font-size:0.875rem;font-weight:600;color:#374151;margin-bottom:0.5rem;">Modo de operación</label>
              <select id="config-mode" style="width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.9375rem;">
                <option value="individual" ${appointmentConfig.mode === 'individual' ? 'selected' : ''}>👤 Individual - Una persona atiende todo</option>
                <option value="multi-resource" ${appointmentConfig.mode === 'multi-resource' ? 'selected' : ''}>👥 Multi-recurso - Varios empleados/cabinas</option>
              </select>
              <p id="mode-description" style="font-size:0.8125rem;color:#6b7280;margin-top:0.5rem;"></p>
            </div>
            
            <div id="resources-section" style="display:${appointmentConfig.mode === 'multi-resource' ? 'block' : 'none'};">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                <label style="font-size:0.875rem;font-weight:600;color:#374151;">Recursos (empleados/cabinas)</label>
                <button type="button" id="add-resource-btn" style="background:#10b981;color:white;border:none;padding:0.375rem 0.75rem;border-radius:0.375rem;font-size:0.8125rem;font-weight:600;cursor:pointer;">+ Agregar</button>
              </div>
              <div id="resources-list">${resourcesHtml}</div>
              
              <div id="add-resource-form" style="display:none;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:0.5rem;padding:0.75rem;margin-top:0.75rem;">
                <input type="text" id="new-resource-name" placeholder="Nombre del recurso (ej: María, Cabina 1)" style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.375rem;margin-bottom:0.5rem;box-sizing:border-box;">
                <div style="display:flex;gap:0.5rem;">
                  <button type="button" id="save-resource-btn" style="flex:1;background:#10b981;color:white;border:none;padding:0.5rem;border-radius:0.375rem;font-weight:600;cursor:pointer;">Guardar</button>
                  <button type="button" id="cancel-resource-btn" style="background:#f3f4f6;color:#374151;border:1px solid #d1d5db;padding:0.5rem 0.75rem;border-radius:0.375rem;cursor:pointer;">Cancelar</button>
                </div>
              </div>
            </div>
            
            <div style="display:flex;gap:0.75rem;justify-content:flex-end;padding-top:1rem;margin-top:1rem;border-top:1px solid #e5e7eb;">
              <button type="button" id="config-cancel" style="padding:0.75rem 1.25rem;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.9375rem;font-weight:600;cursor:pointer;">Cancelar</button>
              <button type="submit" style="padding:0.75rem 1.5rem;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:white;border:none;border-radius:0.5rem;font-size:0.9375rem;font-weight:600;cursor:pointer;">Guardar Configuración</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector('#config-form');
    const modeSelect = modal.querySelector('#config-mode');
    const resourcesSection = modal.querySelector('#resources-section');
    const modeDescription = modal.querySelector('#mode-description');
    
    function updateModeDescription() {
      if (modeSelect.value === 'individual') {
        modeDescription.textContent = 'Un turno reservado bloquea ese horario para todos los servicios. Ideal para profesionales independientes.';
        resourcesSection.style.display = 'none';
      } else {
        modeDescription.textContent = 'Cada recurso tiene sus propios turnos. Un turno reservado solo afecta a ese recurso.';
        resourcesSection.style.display = 'block';
      }
    }
    updateModeDescription();
    modeSelect.addEventListener('change', updateModeDescription);

    const addResourceBtn = modal.querySelector('#add-resource-btn');
    const addResourceForm = modal.querySelector('#add-resource-form');
    const newResourceInput = modal.querySelector('#new-resource-name');
    const saveResourceBtn = modal.querySelector('#save-resource-btn');
    const cancelResourceBtn = modal.querySelector('#cancel-resource-btn');

    addResourceBtn.onclick = () => { addResourceForm.style.display = 'block'; newResourceInput.focus(); };
    cancelResourceBtn.onclick = () => { addResourceForm.style.display = 'none'; newResourceInput.value = ''; };
    saveResourceBtn.onclick = () => {
      const name = newResourceInput.value.trim();
      if (!name) return;
      if (!appointmentConfig.resources) appointmentConfig.resources = [];
      appointmentConfig.resources.push({ id: Date.now().toString(), name: name });
      refreshResourcesList(modal);
      addResourceForm.style.display = 'none';
      newResourceInput.value = '';
    };

    modal.querySelectorAll('.remove-resource').forEach(btn => {
      btn.onclick = () => {
        appointmentConfig.resources.splice(parseInt(btn.dataset.index), 1);
        refreshResourcesList(modal);
      };
    });

    document.getElementById('config-close').onclick = () => modal.remove();
    document.getElementById('config-cancel').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Guardando...';
      try {
        appointmentConfig.mode = modeSelect.value;
        await db.collection('turnos').doc(CATALOG_KEY).set({
          catalogKey: CATALOG_KEY,
          config: appointmentConfig,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        modal.remove();
        updateResourceFilter(); // Actualizar filtro de recursos
        loadAppointments(); // Recargar turnos
        alert('✅ Configuración guardada');
      } catch (error) {
        console.error('Error saving config:', error);
        alert('Error al guardar: ' + error.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar Configuración';
      }
    };
  }

  function refreshResourcesList(modal) {
    const list = modal.querySelector('#resources-list');
    if (appointmentConfig.resources && appointmentConfig.resources.length > 0) {
      list.innerHTML = appointmentConfig.resources.map((r, i) => `
        <div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem;background:#f9fafb;border-radius:0.5rem;margin-bottom:0.5rem;">
          <span style="flex:1;font-weight:500;">${r.name}</span>
          <button type="button" class="remove-resource" data-index="${i}" style="background:#ef4444;color:white;border:none;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:1rem;">×</button>
        </div>
      `).join('');
      list.querySelectorAll('.remove-resource').forEach(btn => {
        btn.onclick = () => {
          appointmentConfig.resources.splice(parseInt(btn.dataset.index), 1);
          refreshResourcesList(modal);
        };
      });
    } else {
      list.innerHTML = '<p style="color:#6b7280;font-size:0.875rem;text-align:center;padding:1rem;">No hay recursos configurados</p>';
    }
  }


  // ============================================
  // BATCH SLOT GENERATOR (Generar Jornada)
  // ============================================
  
  function openBatchModal() {
    console.log('🔥 openBatchModal called');
    const existing = document.getElementById('batch-modal');
    if (existing) existing.remove();

    let servicesOptions = '<option value="">Sin servicio específico</option>';
    SERVICES.forEach(s => { servicesOptions += `<option value="${s.id}">${s.name}</option>`; });

    let resourceSelector = '';
    if (appointmentConfig.mode === 'multi-resource' && appointmentConfig.resources && appointmentConfig.resources.length > 0) {
      let resourceOptions = '<option value="">Seleccionar recurso...</option>';
      appointmentConfig.resources.forEach(r => { resourceOptions += `<option value="${r.id}">${r.name}</option>`; });
      resourceSelector = `
        <div style="margin-bottom:0.75rem;">
          <label style="display:block;font-size:0.75rem;font-weight:600;color:#374151;margin-bottom:0.25rem;">👤 Recurso (empleado/cabina) *</label>
          <select name="resourceId" required style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.875rem;box-sizing:border-box;">${resourceOptions}</select>
        </div>
      `;
    }

    const todayStr = formatDate(new Date());
    
    const modal = document.createElement('div');
    modal.id = 'batch-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;padding:1rem;box-sizing:border-box;';
    modal.innerHTML = `
      <div style="background:white;border-radius:1rem;width:100%;max-width:480px;max-height:calc(100vh - 2rem);display:flex;flex-direction:column;box-shadow:0 25px 60px -12px rgba(0,0,0,0.4);">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.875rem 1rem;background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);color:white;border-radius:1rem 1rem 0 0;flex-shrink:0;">
          <h3 style="font-size:1rem;font-weight:700;margin:0;">⚡ Generar Turnos</h3>
          <button id="batch-close" style="background:rgba(255,255,255,0.2);border:none;width:28px;height:28px;border-radius:0.5rem;color:white;font-size:1.25rem;cursor:pointer;line-height:1;">&times;</button>
        </div>
        <div style="padding:1rem;overflow-y:auto;flex:1;">
          <form id="batch-form">
            ${resourceSelector}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
              <div>
                <label style="display:block;font-size:0.75rem;font-weight:600;color:#374151;margin-bottom:0.25rem;">Fecha inicio</label>
                <input type="date" name="startDate" value="${todayStr}" required style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.875rem;box-sizing:border-box;">
              </div>
              <div>
                <label style="display:block;font-size:0.75rem;font-weight:600;color:#374151;margin-bottom:0.25rem;">Fecha fin</label>
                <input type="date" name="endDate" value="${todayStr}" style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.875rem;box-sizing:border-box;">
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
              <div>
                <label style="display:block;font-size:0.75rem;font-weight:600;color:#374151;margin-bottom:0.25rem;">Hora inicio</label>
                <input type="time" name="startTime" value="09:00" required style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.875rem;box-sizing:border-box;">
              </div>
              <div>
                <label style="display:block;font-size:0.75rem;font-weight:600;color:#374151;margin-bottom:0.25rem;">Hora fin</label>
                <input type="time" name="endTime" value="18:00" required style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.875rem;box-sizing:border-box;">
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
              <div>
                <label style="display:block;font-size:0.75rem;font-weight:600;color:#374151;margin-bottom:0.25rem;">Duración</label>
                <select name="duration" style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.875rem;box-sizing:border-box;">
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60" selected>1 hora</option>
                  <option value="90">1.5 horas</option>
                  <option value="120">2 horas</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-size:0.75rem;font-weight:600;color:#374151;margin-bottom:0.25rem;">Servicio</label>
                <select name="serviceId" style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.875rem;box-sizing:border-box;">${servicesOptions}</select>
              </div>
            </div>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:0.5rem;padding:0.5rem 0.75rem;margin-bottom:0.75rem;">
              <label style="display:flex;align-items:center;gap:0.5rem;padding:0.375rem 0;cursor:pointer;font-size:0.8125rem;color:#374151;border-bottom:1px solid #e5e7eb;">
                <input type="checkbox" name="excludeLunch" checked style="width:16px;height:16px;">
                <span>Excluir almuerzo (13:00-14:00)</span>
              </label>
              <label style="display:flex;align-items:center;gap:0.5rem;padding:0.375rem 0;cursor:pointer;font-size:0.8125rem;color:#374151;border-bottom:1px solid #e5e7eb;">
                <input type="checkbox" name="weekdaysOnly" style="width:16px;height:16px;">
                <span>Solo días hábiles (Lun-Vie)</span>
              </label>
              <label style="display:flex;align-items:center;gap:0.5rem;padding:0.375rem 0;cursor:pointer;font-size:0.8125rem;color:#374151;">
                <input type="checkbox" name="skipExisting" checked style="width:16px;height:16px;">
                <span>No sobrescribir existentes</span>
              </label>
            </div>
            <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:0.75rem;padding:0.75rem;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;color:#6b21a8;font-size:0.875rem;">Vista previa</span>
                <span id="batch-count" style="background:#f97316;color:white;padding:0.2rem 0.6rem;border-radius:2rem;font-weight:700;font-size:0.75rem;">0 turnos</span>
              </div>
              <div id="batch-preview-list" style="display:flex;flex-wrap:wrap;gap:0.25rem;margin-top:0.5rem;max-height:60px;overflow-y:auto;"></div>
            </div>
          </form>
        </div>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end;padding:0.875rem 1rem;border-top:1px solid #e5e7eb;background:#f9fafb;border-radius:0 0 1rem 1rem;flex-shrink:0;">
          <button type="button" id="batch-cancel" style="padding:0.625rem 1rem;background:#fff;color:#374151;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.875rem;font-weight:600;cursor:pointer;">Cancelar</button>
          <button type="button" id="batch-submit" style="padding:0.625rem 1.25rem;background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);color:white;border:none;border-radius:0.5rem;font-size:0.875rem;font-weight:600;cursor:pointer;">Generar Turnos</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector('#batch-form');
    document.getElementById('batch-close').onclick = closeBatchModal;
    document.getElementById('batch-cancel').onclick = closeBatchModal;
    document.getElementById('batch-submit').onclick = () => handleBatchSubmit(form);
    modal.onclick = (e) => { if (e.target === modal) closeBatchModal(); };

    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(input => { input.addEventListener('change', () => updateBatchPreview(form)); });
    updateBatchPreview(form);
  }

  function closeBatchModal() {
    const modal = document.getElementById('batch-modal');
    if (modal) modal.remove();
  }

  function generateTimeSlots(startTime, endTime, duration, excludeLunch) {
    const slots = [];
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    while (currentMinutes + duration <= endMinutes) {
      const h = Math.floor(currentMinutes / 60);
      const m = currentMinutes % 60;
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (excludeLunch && currentMinutes >= 780 && currentMinutes < 840) { currentMinutes = 840; continue; }
      slots.push(timeStr);
      currentMinutes += duration;
    }
    return slots;
  }

  function generateDateRange(startDate, endDate, weekdaysOnly) {
    const dates = [];
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    while (start <= end) {
      const dayOfWeek = start.getDay();
      if (!weekdaysOnly || (dayOfWeek >= 1 && dayOfWeek <= 5)) dates.push(formatDate(start));
      start.setDate(start.getDate() + 1);
    }
    return dates;
  }

  function updateBatchPreview(form) {
    const formData = new FormData(form);
    const startDate = formData.get('startDate');
    const endDate = formData.get('endDate') || startDate;
    const startTime = formData.get('startTime');
    const endTime = formData.get('endTime');
    const duration = parseInt(formData.get('duration'));
    const excludeLunch = form.querySelector('[name="excludeLunch"]').checked;
    const weekdaysOnly = form.querySelector('[name="weekdaysOnly"]').checked;
    const dates = generateDateRange(startDate, endDate, weekdaysOnly);
    const times = generateTimeSlots(startTime, endTime, duration, excludeLunch);
    const totalSlots = dates.length * times.length;
    document.getElementById('batch-count').textContent = `${totalSlots} turnos`;
    const previewList = document.getElementById('batch-preview-list');
    if (dates.length === 1) {
      previewList.innerHTML = times.map(t => `<span style="background:#e9d5ff;color:#6b21a8;padding:0.25rem 0.5rem;border-radius:0.25rem;font-size:0.75rem;">${t}</span>`).join('');
    } else {
      previewList.innerHTML = `<span style="color:#6b21a8;font-size:0.875rem;">${dates.length} días × ${times.length} turnos/día</span>`;
    }
  }

  async function handleBatchSubmit(form) {
    const submitBtn = document.getElementById('batch-submit');
    if (submitBtn.disabled) return;
    
    const formData = new FormData(form);
    const startDate = formData.get('startDate');
    const endDate = formData.get('endDate') || startDate;
    const startTime = formData.get('startTime');
    const endTime = formData.get('endTime');
    const duration = parseInt(formData.get('duration'));
    const serviceId = formData.get('serviceId') || null;
    const resourceId = formData.get('resourceId') || null;
    const excludeLunch = form.querySelector('[name="excludeLunch"]').checked;
    const weekdaysOnly = form.querySelector('[name="weekdaysOnly"]').checked;
    const skipExisting = form.querySelector('[name="skipExisting"]').checked;

    const service = SERVICES.find(s => s.id == serviceId);
    const resource = appointmentConfig.resources?.find(r => r.id == resourceId);
    const dates = generateDateRange(startDate, endDate, weekdaysOnly);
    const times = generateTimeSlots(startTime, endTime, duration, excludeLunch);

    if (dates.length === 0 || times.length === 0) { alert('No hay turnos para generar'); return; }

    const totalSlots = dates.length * times.length;
    const dateRange = dates.length === 1 ? `el ${startDate}` : `del ${startDate} al ${endDate} (${dates.length} días)`;
    const confirmMsg = `¿Confirmar generación de ${totalSlots} turnos?\n\n📅 Fechas: ${dateRange}\n⏰ Horarios: ${times[0]} a ${times[times.length-1]}\n⏱️ Duración: ${duration} min` + 
      (service ? `\n💅 Servicio: ${service.name}` : '') +
      (resource ? `\n👤 Recurso: ${resource.name}` : '') +
      (skipExisting ? '\n\n✓ Se omitirán turnos existentes' : '\n\n⚠️ Se crearán aunque ya existan');

    if (!confirm(confirmMsg)) return;

    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Generando...';

    try {
      const catalogRef = db.collection('turnos').doc(CATALOG_KEY);
      const parentDoc = await catalogRef.get();
      if (!parentDoc.exists) await catalogRef.set({ catalogKey: CATALOG_KEY, createdAt: new Date().toISOString() });

      let created = 0, skipped = 0;

      for (const dateStr of dates) {
        let existingTimes = new Set();
        if (skipExisting) {
          let existingQuery = catalogRef.collection('slots').where('date', '==', dateStr);
          if (resourceId) existingQuery = existingQuery.where('resourceId', '==', resourceId);
          const existing = await existingQuery.get();
          existing.forEach(doc => existingTimes.add(doc.data().time));
        }

        const batch = db.batch();
        let batchCount = 0;

        for (const time of times) {
          if (skipExisting && existingTimes.has(time)) { skipped++; continue; }
          const slotRef = catalogRef.collection('slots').doc();
          batch.set(slotRef, {
            date: dateStr, time: time,
            serviceId: serviceId, serviceName: service?.name || null, servicePrice: service?.price || null,
            resourceId: resourceId, resourceName: resource?.name || null,
            status: 'available', createdAt: new Date().toISOString()
          });
          batchCount++; created++;
        }
        if (batchCount > 0) await batch.commit();
      }

      closeBatchModal();
      loadAppointments();
      loadStats();
      let msg = `✅ Se crearon ${created} turnos`;
      if (resource) msg += ` para ${resource.name}`;
      if (skipped > 0) msg += ` (${skipped} omitidos)`;
      alert(msg);
    } catch (error) {
      console.error('Error generating batch:', error);
      alert('Error al generar turnos: ' + error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }


  // ============================================
  // INITIALIZATION
  // ============================================

  document.addEventListener('DOMContentLoaded', () => {
    // Register batch button
    const batchBtn = document.getElementById('batch-btn');
    if (batchBtn) {
      console.log('✅ Batch button found');
      batchBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔥 Batch button clicked');
        openBatchModal();
      });
    }

    // Register config button
    const configBtn = document.getElementById('config-btn');
    if (configBtn) {
      console.log('✅ Config button found');
      configBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔥 Config button clicked');
        openConfigModal();
      });
    }

    if (!initFirebase()) return;

    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    
    document.getElementById('prev-day').addEventListener('click', () => navigateDate(-1));
    document.getElementById('next-day').addEventListener('click', () => navigateDate(1));
    document.getElementById('today-btn').addEventListener('click', goToToday);
    document.getElementById('add-slot-btn').addEventListener('click', openAddModal);
    
    slotForm.addEventListener('submit', handleSlotSubmit);
    slotModal.querySelector('.modal-close').addEventListener('click', closeModal);
    slotModal.querySelector('.modal-cancel').addEventListener('click', closeModal);
    slotModal.addEventListener('click', (e) => { if (e.target === slotModal) closeModal(); });
  });

})();
