/**
 * Admin Panel for Appointments Management
 * Firebase-powered appointment management
 */
(function() {
  'use strict';
  var FIREBASE_CONFIG = window.FIREBASE_CONFIG;
  var CATALOG_KEY = window.CATALOG_KEY;
  var SERVICES = window.SERVICES || [];
  var firebaseApp = null;
  var auth = null;
  var db = null;
  var currentUser = null;
  var currentDate = new Date();
  var editingSlotId = null;
  var pricesCache = {};
  var pricesLoaded = false;
  var appointmentConfig = { mode: 'individual', resources: [] };
  var selectedResourceFilter = null;
  var selectedStatusFilter = null;
  var loadingScreen = document.getElementById('loading-screen');
  var loginScreen = document.getElementById('login-screen');
  var dashboard = document.getElementById('admin-dashboard');
  var loginForm = document.getElementById('login-form');
  var loginError = document.getElementById('login-error');
  var logoutBtn = document.getElementById('logout-btn');
  var userEmailEl = document.getElementById('user-email');
  var currentDateEl = document.getElementById('current-date');
  var appointmentsList = document.getElementById('appointments-list');
  var slotModal = document.getElementById('slot-modal');
  var slotForm = document.getElementById('slot-form');

  function initFirebase() {
    if (!FIREBASE_CONFIG) { console.error('Firebase config not found'); hideLoading(); showError('Error de configuracion'); return false; }
    try {
      firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
      auth.onAuthStateChanged(handleAuthStateChange);
      return true;
    } catch (error) { console.error('Error initializing Firebase:', error); hideLoading(); showError('Error al conectar con Firebase'); return false; }
  }

  function hideLoading() { if (loadingScreen) loadingScreen.style.display = 'none'; }

  function loadFirebasePrices() {
    return new Promise(function(resolve) {
      if (!db || !CATALOG_KEY || pricesLoaded) { resolve(); return; }
      db.collection('precios').doc(CATALOG_KEY).collection('items').get()
        .then(function(snapshot) {
          if (!snapshot.empty) {
            snapshot.forEach(function(doc) {
              var itemId = doc.id;
              var data = doc.data();
              pricesCache[itemId] = data.price;
              var service = SERVICES.find(function(s) { return String(s.id) === String(itemId); });
              if (service && data.price !== undefined) { service.priceRaw = data.price; service.price = formatServicePrice(data.price); }
            });
            updateServiceDropdown();
          }
          pricesLoaded = true;
          resolve();
        }).catch(function(error) { console.error('Error loading Firebase prices:', error); resolve(); });
    });
  }

  function formatServicePrice(price) {
    if (price === null || price === undefined) return '';
    var numPrice = parseFloat(price);
    if (isNaN(numPrice)) return String(price);
    return '$' + numPrice.toLocaleString('es-AR');
  }

  function updateServiceDropdown() {
    var serviceSelect = document.getElementById('slot-service');
    if (!serviceSelect) return;
    var html = '<option value="">Sin servicio especifico</option>';
    SERVICES.forEach(function(s) { html += '<option value="' + s.id + '">' + s.name + ' - ' + s.price + '</option>'; });
    serviceSelect.innerHTML = html;
  }
  function handleAuthStateChange(user) {
    currentUser = user;
    hideLoading();
    if (user) {
      loginScreen.style.display = 'none';
      dashboard.style.display = 'block';
      userEmailEl.textContent = user.email;
      loadFirebasePrices().then(function() {
        loadAppointmentConfig().then(function() { loadAppointments(); loadStats(); });
      });
    } else { loginScreen.style.display = 'flex'; dashboard.style.display = 'none'; }
  }

  function handleLogin(e) {
    e.preventDefault();
    var email = loginForm.email.value;
    var password = loginForm.password.value;
    var submitBtn = loginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Iniciando sesion...';
    hideError();
    auth.signInWithEmailAndPassword(email, password)
      .catch(function(error) {
        var message = 'Error al iniciar sesion';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') message = 'Email o contrasena incorrectos';
        else if (error.code === 'auth/too-many-requests') message = 'Demasiados intentos';
        else if (error.code === 'auth/network-request-failed') message = 'Error de conexion';
        showError(message);
      }).finally(function() {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg> Iniciar Sesion';
      });
  }

  function handleLogout() { auth.signOut().catch(function(error) { console.error('Logout error:', error); }); }
  function showError(message) { loginError.textContent = message; loginError.style.display = 'block'; }
  function hideError() { loginError.style.display = 'none'; }

  function loadAppointmentConfig() {
    return new Promise(function(resolve) {
      if (!db || !CATALOG_KEY) { resolve(); return; }
      db.collection('turnos').doc(CATALOG_KEY).get()
        .then(function(doc) {
          if (doc.exists && doc.data().config) appointmentConfig = doc.data().config;
          updateResourceFilter();
          updateStatusFilter();
          resolve();
        }).catch(function(error) { console.error('Error loading config:', error); resolve(); });
    });
  }

  function updateResourceFilter() {
    var existingFilter = document.getElementById('resource-filter-container');
    if (existingFilter) existingFilter.remove();
    if (appointmentConfig.mode !== 'multi-resource' || !appointmentConfig.resources || appointmentConfig.resources.length === 0) return;
    var calendarNav = document.querySelector('.admin-calendar-nav');
    if (!calendarNav) return;
    var options = '<option value="">Todos</option>';
    appointmentConfig.resources.forEach(function(r) {
      var selected = selectedResourceFilter === r.id ? 'selected' : '';
      options += '<option value="' + r.id + '" ' + selected + '>' + r.name + '</option>';
    });
    var filterContainer = document.createElement('div');
    filterContainer.id = 'resource-filter-container';
    filterContainer.style.cssText = 'display:inline-flex;align-items:center;margin-left:1rem;';
    filterContainer.innerHTML = '<select id="resource-filter" style="padding:0.5rem 0.75rem;border:2px solid #e0e7ff;border-radius:0.5rem;font-size:0.875rem;font-weight:500;background:white;color:#4338ca;cursor:pointer;">' + options + '</select>';
    calendarNav.appendChild(filterContainer);
    document.getElementById('resource-filter').addEventListener('change', function(e) { selectedResourceFilter = e.target.value || null; loadAppointments(); });
  }

  function updateStatusFilter() {
    var existingFilter = document.getElementById('status-filter-container');
    if (existingFilter) existingFilter.remove();
    var calendarNav = document.querySelector('.admin-calendar-nav');
    if (!calendarNav) return;
    var statusOptions = [
      { value: '', label: 'Todos los estados' },
      { value: 'available', label: 'Disponible' },
      { value: 'booked', label: 'Reservado' },
      { value: 'blocked', label: 'Bloqueado' },
      { value: 'completed', label: 'Completado' },
      { value: 'cancelled', label: 'Cancelado' }
    ];
    var options = '';
    statusOptions.forEach(function(opt) {
      var selected = selectedStatusFilter === opt.value ? 'selected' : '';
      if (!selectedStatusFilter && opt.value === '') selected = 'selected';
      options += '<option value="' + opt.value + '" ' + selected + '>' + opt.label + '</option>';
    });
    var filterContainer = document.createElement('div');
    filterContainer.id = 'status-filter-container';
    filterContainer.style.cssText = 'display:inline-flex;align-items:center;margin-left:0.75rem;';
    filterContainer.innerHTML = '<select id="status-filter" style="padding:0.5rem 0.75rem;border:2px solid #fde68a;border-radius:0.5rem;font-size:0.875rem;font-weight:500;background:white;color:#d97706;cursor:pointer;">' + options + '</select>';
    calendarNav.appendChild(filterContainer);
    document.getElementById('status-filter').addEventListener('change', function(e) { selectedStatusFilter = e.target.value || null; loadAppointments(); });
  }
  function loadAppointments() {
    if (!db || !CATALOG_KEY) return;
    var dateStr = formatDate(currentDate);
    updateDateDisplay();
    appointmentsList.innerHTML = '<div class="loading">Cargando turnos...</div>';
    var query = db.collection('turnos').doc(CATALOG_KEY).collection('slots').where('date', '==', dateStr);
    if (selectedResourceFilter) query = query.where('resourceId', '==', selectedResourceFilter);
    query.get().then(function(snapshot) {
      if (snapshot.empty) {
        appointmentsList.innerHTML = '<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg><p>No hay turnos para este dia</p></div>';
        return;
      }
      var slots = [];
      snapshot.forEach(function(doc) { slots.push(Object.assign({ id: doc.id }, doc.data())); });
      if (selectedStatusFilter) {
        slots = slots.filter(function(slot) { return slot.status === selectedStatusFilter; });
      }
      if (slots.length === 0) {
        appointmentsList.innerHTML = '<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg><p>No hay turnos con este estado</p></div>';
        return;
      }
      slots.sort(function(a, b) { return (a.time || '').localeCompare(b.time || ''); });
      var html = '';
      slots.forEach(function(slot) { html += renderAppointmentItem(slot); });
      appointmentsList.innerHTML = html;
      appointmentsList.querySelectorAll('.edit-btn').forEach(function(btn) { btn.addEventListener('click', function() { openEditModal(btn.dataset.id); }); });
      appointmentsList.querySelectorAll('.delete-btn').forEach(function(btn) { btn.addEventListener('click', function() { deleteSlot(btn.dataset.id); }); });
    }).catch(function(error) { console.error('Error loading appointments:', error); appointmentsList.innerHTML = '<div class="empty-state"><p>Error al cargar turnos</p></div>'; });
  }

  function renderAppointmentItem(slot) {
    var statusLabels = { available: 'Disponible', booked: 'Reservado', blocked: 'Bloqueado', completed: 'Completado', cancelled: 'Cancelado' };
    var resourceBadge = slot.resourceName ? '<span style="background:#e0e7ff;color:#4338ca;padding:0.125rem 0.5rem;border-radius:1rem;font-size:0.6875rem;font-weight:600;margin-left:0.5rem;">' + slot.resourceName + '</span>' : '';
    var clientInfo = slot.clientName ? '<div class="appointment-client">' + slot.clientName + (slot.clientPhone ? ' - ' + slot.clientPhone : '') + '</div>' : '';
    return '<div class="appointment-item" data-id="' + slot.id + '"><div class="appointment-time">' + slot.time + '</div><div class="appointment-info"><div class="appointment-service">' + (slot.serviceName || 'Sin servicio') + resourceBadge + '</div>' + clientInfo + '</div><span class="appointment-status ' + slot.status + '">' + (statusLabels[slot.status] || slot.status) + '</span><div class="appointment-actions"><button class="edit-btn" data-id="' + slot.id + '" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button><button class="delete-btn delete" data-id="' + slot.id + '" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div></div>';
  }

  function loadStats() {
    if (!db || !CATALOG_KEY) return;
    var today = formatDate(new Date());
    db.collection('turnos').doc(CATALOG_KEY).collection('slots').get().then(function(snapshot) {
      var allSlots = [];
      snapshot.forEach(function(doc) { allSlots.push(Object.assign({ id: doc.id }, doc.data())); });
      var statToday = document.getElementById('stat-today');
      var statWeek = document.getElementById('stat-week');
      var statPending = document.getElementById('stat-pending');
      if (statToday) statToday.textContent = allSlots.filter(function(s) { return s.date === today && s.status === 'booked'; }).length;
      var weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      var weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
      if (statWeek) statWeek.textContent = allSlots.filter(function(s) { return s.date >= formatDate(weekStart) && s.date <= formatDate(weekEnd) && s.status === 'booked'; }).length;
      if (statPending) statPending.textContent = allSlots.filter(function(s) { return s.date >= today && s.status === 'booked'; }).length;
    }).catch(function(error) { console.error('Error loading stats:', error); });
  }

  function navigateDate(delta) { currentDate.setDate(currentDate.getDate() + delta); loadAppointments(); }
  function goToToday() { currentDate = new Date(); loadAppointments(); }

  function updateDateDisplay() {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var current = new Date(currentDate); current.setHours(0, 0, 0, 0);
    var options = { weekday: 'long', day: 'numeric', month: 'long' };
    var text = currentDate.toLocaleDateString('es-AR', options);
    if (current.getTime() === today.getTime()) text = 'Hoy - ' + text;
    currentDateEl.textContent = text.charAt(0).toUpperCase() + text.slice(1);
  }

  function formatDate(date) { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); }
  function openAddModal() {
    editingSlotId = null;
    document.getElementById('slot-modal-title').textContent = 'Agregar Turno';
    slotForm.reset();
    slotModal.style.display = 'flex';
  }

  function openEditModal(slotId) {
    editingSlotId = slotId;
    document.getElementById('slot-modal-title').textContent = 'Editar Turno';
    db.collection('turnos').doc(CATALOG_KEY).collection('slots').doc(slotId).get().then(function(doc) {
      if (doc.exists) {
        var data = doc.data();
        slotForm.time.value = data.time || '';
        slotForm.serviceId.value = data.serviceId || '';
        slotForm.clientName.value = data.clientName || '';
        slotForm.clientPhone.value = data.clientPhone || '';
        slotForm.notes.value = data.notes || '';
        slotForm.status.value = data.status || 'available';
      }
      slotModal.style.display = 'flex';
    }).catch(function(error) { console.error('Error loading slot:', error); alert('Error al cargar el turno'); });
  }

  function closeModal() { slotModal.style.display = 'none'; editingSlotId = null; }

  function handleSlotSubmit(e) {
    e.preventDefault();
    var submitBtn = slotForm.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    var formData = new FormData(slotForm);
    var time = formData.get('time');
    var dateStr = formatDate(currentDate);
    if (!time) { alert('Debes seleccionar un horario'); return; }
    submitBtn.disabled = true;
    var originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Guardando...';
    var service = SERVICES.find(function(s) { return s.id == formData.get('serviceId'); });
    var resource = null;
    if (appointmentConfig.mode === 'multi-resource' && appointmentConfig.resources) {
      var resourceId = formData.get('resourceId');
      resource = appointmentConfig.resources.find(function(r) { return r.id === resourceId; });
    }
    var slotData = {
      date: dateStr, time: time,
      serviceId: formData.get('serviceId') || null,
      serviceName: service ? service.name : null,
      servicePrice: service ? service.price : null,
      resourceId: resource ? resource.id : null,
      resourceName: resource ? resource.name : null,
      clientName: formData.get('clientName') || null,
      clientPhone: formData.get('clientPhone') || null,
      notes: formData.get('notes') || null,
      status: formData.get('status'),
      updatedAt: new Date().toISOString()
    };
    var catalogRef = db.collection('turnos').doc(CATALOG_KEY);
    var saveSlot = function() {
      if (editingSlotId) return catalogRef.collection('slots').doc(editingSlotId).update(slotData);
      slotData.createdAt = new Date().toISOString();
      return catalogRef.get().then(function(parentDoc) {
        if (!parentDoc.exists) return catalogRef.set({ catalogKey: CATALOG_KEY, createdAt: new Date().toISOString() });
      }).then(function() { return catalogRef.collection('slots').add(slotData); });
    };
    var checkAndSave = function() {
      if (!editingSlotId) {
        return catalogRef.collection('slots').where('date', '==', dateStr).where('time', '==', time).get().then(function(existingSlots) {
          if (!existingSlots.empty) throw { code: 'slot-exists', message: 'Ya existe un turno a las ' + time };
          return saveSlot();
        });
      }
      return saveSlot();
    };
    checkAndSave().then(function() { closeModal(); loadAppointments(); loadStats(); })
      .catch(function(error) {
        if (error.code === 'slot-exists') alert(error.message);
        else if (error.code === 'permission-denied') alert('Sin permisos para guardar.');
        else alert('Error al guardar el turno');
      }).finally(function() { submitBtn.disabled = false; submitBtn.innerHTML = originalText; });
  }

  function deleteSlot(slotId) {
    if (!confirm('Estas seguro de eliminar este turno?')) return;
    db.collection('turnos').doc(CATALOG_KEY).collection('slots').doc(slotId).delete()
      .then(function() { loadAppointments(); loadStats(); })
      .catch(function(error) { console.error('Error deleting slot:', error); alert('Error al eliminar el turno'); });
  }
  function openConfigModal() {
    var existing = document.getElementById('config-modal');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'config-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;';
    var resourcesHtml = appointmentConfig.resources && appointmentConfig.resources.length > 0 
      ? appointmentConfig.resources.map(function(r, i) { return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem;background:#f9fafb;border-radius:0.5rem;margin-bottom:0.5rem;"><span style="flex:1;font-weight:500;">' + r.name + '</span><button type="button" class="remove-resource" data-index="' + i + '" style="background:#ef4444;color:white;border:none;width:24px;height:24px;border-radius:4px;cursor:pointer;">x</button></div>'; }).join('')
      : '<p style="color:#6b7280;font-size:0.875rem;text-align:center;padding:1rem;">No hay recursos configurados</p>';
    var modeIndividualSelected = appointmentConfig.mode === 'individual' ? 'selected' : '';
    var modeMultiSelected = appointmentConfig.mode === 'multi-resource' ? 'selected' : '';
    var resourcesDisplay = appointmentConfig.mode === 'multi-resource' ? 'block' : 'none';
    modal.innerHTML = '<div style="background:white;border-radius:1rem;width:100%;max-width:450px;max-height:90vh;overflow:hidden;box-shadow:0 25px 60px -12px rgba(0,0,0,0.4);"><div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:white;"><h3 style="font-size:1.125rem;font-weight:700;margin:0;">Configuracion de Turnos</h3><button id="config-close" style="background:rgba(255,255,255,0.2);border:none;width:32px;height:32px;border-radius:0.5rem;color:white;font-size:1.5rem;cursor:pointer;">x</button></div><div style="padding:1.25rem;overflow-y:auto;max-height:calc(90vh - 70px);"><form id="config-form"><div style="margin-bottom:1.25rem;"><label style="display:block;font-size:0.875rem;font-weight:600;color:#374151;margin-bottom:0.5rem;">Modo de operacion</label><select id="config-mode" style="width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.9375rem;"><option value="individual" ' + modeIndividualSelected + '>Individual</option><option value="multi-resource" ' + modeMultiSelected + '>Multi-recurso</option></select><p id="mode-description" style="font-size:0.8125rem;color:#6b7280;margin-top:0.5rem;"></p></div><div id="resources-section" style="display:' + resourcesDisplay + ';"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;"><label style="font-size:0.875rem;font-weight:600;color:#374151;">Recursos</label><button type="button" id="add-resource-btn" style="background:#10b981;color:white;border:none;padding:0.375rem 0.75rem;border-radius:0.375rem;font-size:0.8125rem;font-weight:600;cursor:pointer;">+ Agregar</button></div><div id="resources-list">' + resourcesHtml + '</div><div id="add-resource-form" style="display:none;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:0.5rem;padding:0.75rem;margin-top:0.75rem;"><input type="text" id="new-resource-name" placeholder="Nombre del recurso" style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.375rem;margin-bottom:0.5rem;box-sizing:border-box;"><div style="display:flex;gap:0.5rem;"><button type="button" id="save-resource-btn" style="flex:1;background:#10b981;color:white;border:none;padding:0.5rem;border-radius:0.375rem;font-weight:600;cursor:pointer;">Guardar</button><button type="button" id="cancel-resource-btn" style="background:#f3f4f6;color:#374151;border:1px solid #d1d5db;padding:0.5rem 0.75rem;border-radius:0.375rem;cursor:pointer;">Cancelar</button></div></div></div><div style="display:flex;gap:0.75rem;justify-content:flex-end;padding-top:1rem;margin-top:1rem;border-top:1px solid #e5e7eb;"><button type="button" id="config-cancel" style="padding:0.75rem 1.25rem;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.9375rem;font-weight:600;cursor:pointer;">Cancelar</button><button type="submit" style="padding:0.75rem 1.5rem;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:white;border:none;border-radius:0.5rem;font-size:0.9375rem;font-weight:600;cursor:pointer;">Guardar</button></div></form></div></div>';
    document.body.appendChild(modal);
    var form = modal.querySelector('#config-form');
    var modeSelect = modal.querySelector('#config-mode');
    var resourcesSection = modal.querySelector('#resources-section');
    var modeDescription = modal.querySelector('#mode-description');
    function updateModeDescription() {
      modeDescription.textContent = modeSelect.value === 'individual' ? 'Un turno reservado bloquea ese horario.' : 'Cada recurso tiene sus propios turnos.';
      resourcesSection.style.display = modeSelect.value === 'multi-resource' ? 'block' : 'none';
    }
    updateModeDescription();
    modeSelect.addEventListener('change', updateModeDescription);
    modal.querySelector('#add-resource-btn').onclick = function() { modal.querySelector('#add-resource-form').style.display = 'block'; modal.querySelector('#new-resource-name').focus(); };
    modal.querySelector('#cancel-resource-btn').onclick = function() { modal.querySelector('#add-resource-form').style.display = 'none'; modal.querySelector('#new-resource-name').value = ''; };
    modal.querySelector('#save-resource-btn').onclick = function() {
      var name = modal.querySelector('#new-resource-name').value.trim();
      if (!name) return;
      if (!appointmentConfig.resources) appointmentConfig.resources = [];
      appointmentConfig.resources.push({ id: Date.now().toString(), name: name });
      refreshResourcesList(modal);
      modal.querySelector('#add-resource-form').style.display = 'none';
      modal.querySelector('#new-resource-name').value = '';
    };
    modal.querySelectorAll('.remove-resource').forEach(function(btn) { btn.onclick = function() { appointmentConfig.resources.splice(parseInt(btn.dataset.index), 1); refreshResourcesList(modal); }; });
    document.getElementById('config-close').onclick = function() { modal.remove(); };
    document.getElementById('config-cancel').onclick = function() { modal.remove(); };
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
    form.onsubmit = function(e) {
      e.preventDefault();
      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Guardando...';
      appointmentConfig.mode = modeSelect.value;
      db.collection('turnos').doc(CATALOG_KEY).set({ catalogKey: CATALOG_KEY, config: appointmentConfig, updatedAt: new Date().toISOString() }, { merge: true })
        .then(function() { modal.remove(); updateResourceFilter(); updateStatusFilter(); loadAppointments(); alert('Configuracion guardada'); })
        .catch(function(error) { alert('Error al guardar: ' + error.message); })
        .finally(function() { submitBtn.disabled = false; submitBtn.textContent = 'Guardar'; });
    };
  }

  function refreshResourcesList(modal) {
    var list = modal.querySelector('#resources-list');
    if (appointmentConfig.resources && appointmentConfig.resources.length > 0) {
      list.innerHTML = appointmentConfig.resources.map(function(r, i) { return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem;background:#f9fafb;border-radius:0.5rem;margin-bottom:0.5rem;"><span style="flex:1;font-weight:500;">' + r.name + '</span><button type="button" class="remove-resource" data-index="' + i + '" style="background:#ef4444;color:white;border:none;width:24px;height:24px;border-radius:4px;cursor:pointer;">x</button></div>'; }).join('');
      list.querySelectorAll('.remove-resource').forEach(function(btn) { btn.onclick = function() { appointmentConfig.resources.splice(parseInt(btn.dataset.index), 1); refreshResourcesList(modal); }; });
    } else { list.innerHTML = '<p style="color:#6b7280;font-size:0.875rem;text-align:center;padding:1rem;">No hay recursos configurados</p>'; }
  }
  function openBatchModal() {
    var existing = document.getElementById('batch-modal');
    if (existing) existing.remove();
    var servicesOptions = '<option value="">Sin servicio especifico</option>';
    SERVICES.forEach(function(s) { servicesOptions += '<option value="' + s.id + '">' + s.name + '</option>'; });
    var resourceSelector = '';
    if (appointmentConfig.mode === 'multi-resource' && appointmentConfig.resources && appointmentConfig.resources.length > 0) {
      var resourceOptions = '<option value="">Seleccionar recurso...</option>';
      appointmentConfig.resources.forEach(function(r) { resourceOptions += '<option value="' + r.id + '">' + r.name + '</option>'; });
      resourceSelector = '<div style="margin-bottom:0.75rem;"><label style="display:block;font-size:0.75rem;font-weight:600;color:#374151;margin-bottom:0.25rem;">Recurso *</label><select name="resourceId" required style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.875rem;box-sizing:border-box;">' + resourceOptions + '</select></div>';
    }
    var modal = document.createElement('div');
    modal.id = 'batch-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;';
    modal.innerHTML = '<div style="background:white;border-radius:1rem;width:100%;max-width:400px;max-height:90vh;overflow:hidden;box-shadow:0 25px 60px -12px rgba(0,0,0,0.4);"><div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:white;"><h3 style="font-size:1.125rem;font-weight:700;margin:0;">Generar Jornada</h3><button id="batch-close" style="background:rgba(255,255,255,0.2);border:none;width:32px;height:32px;border-radius:0.5rem;color:white;font-size:1.5rem;cursor:pointer;">x</button></div><div style="padding:1.25rem;overflow-y:auto;max-height:calc(90vh - 70px);"><form id="batch-form">' + resourceSelector + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;"><div><label style="display:block;font-size:0.75rem;font-weight:600;color:#374151;margin-bottom:0.25rem;">Hora inicio</label><select name="startTime" style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.875rem;"><option value="08:00">08:00</option><option value="09:00" selected>09:00</option><option value="10:00">10:00</option><option value="11:00">11:00</option><option value="12:00">12:00</option></select></div><div><label style="display:block;font-size:0.75rem;font-weight:600;color:#374151;margin-bottom:0.25rem;">Hora fin</label><select name="endTime" style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.875rem;"><option value="17:00">17:00</option><option value="18:00" selected>18:00</option><option value="19:00">19:00</option><option value="20:00">20:00</option><option value="21:00">21:00</option></select></div></div><div style="margin-bottom:0.75rem;"><label style="display:block;font-size:0.75rem;font-weight:600;color:#374151;margin-bottom:0.25rem;">Duracion</label><select name="duration" style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.875rem;"><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60" selected>1 hora</option><option value="90">1h 30min</option><option value="120">2 horas</option></select></div><div style="margin-bottom:0.75rem;"><label style="display:block;font-size:0.75rem;font-weight:600;color:#374151;margin-bottom:0.25rem;">Servicio (opcional)</label><select name="serviceId" style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.875rem;">' + servicesOptions + '</select></div><div style="margin-bottom:1rem;"><label style="display:block;font-size:0.75rem;font-weight:600;color:#374151;margin-bottom:0.25rem;">Estado inicial</label><select name="status" style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:0.875rem;"><option value="available">Disponible</option><option value="blocked">Bloqueado</option></select></div><div style="display:flex;gap:0.75rem;"><button type="button" id="batch-cancel" style="flex:1;padding:0.75rem;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:0.5rem;font-weight:600;cursor:pointer;">Cancelar</button><button type="submit" style="flex:1;padding:0.75rem;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:white;border:none;border-radius:0.5rem;font-weight:600;cursor:pointer;">Generar</button></div></form></div></div>';
    document.body.appendChild(modal);
    document.getElementById('batch-close').onclick = function() { modal.remove(); };
    document.getElementById('batch-cancel').onclick = function() { modal.remove(); };
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
    document.getElementById('batch-form').onsubmit = function(e) {
      e.preventDefault();
      var formData = new FormData(e.target);
      var submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Generando...';
      var startTime = formData.get('startTime');
      var endTime = formData.get('endTime');
      var duration = parseInt(formData.get('duration'));
      var serviceId = formData.get('serviceId');
      var status = formData.get('status');
      var resourceId = formData.get('resourceId') || null;
      var service = serviceId ? SERVICES.find(function(s) { return s.id == serviceId; }) : null;
      var resource = resourceId && appointmentConfig.resources ? appointmentConfig.resources.find(function(r) { return r.id === resourceId; }) : null;
      var slots = [];
      var currentTime = startTime;
      while (currentTime < endTime) {
        slots.push({ date: formatDate(currentDate), time: currentTime, serviceId: serviceId || null, serviceName: service ? service.name : null, servicePrice: service ? service.price : null, resourceId: resourceId, resourceName: resource ? resource.name : null, status: status, createdAt: new Date().toISOString() });
        var parts = currentTime.split(':').map(Number);
        var totalMins = parts[0] * 60 + parts[1] + duration;
        currentTime = String(Math.floor(totalMins / 60)).padStart(2, '0') + ':' + String(totalMins % 60).padStart(2, '0');
      }
      var catalogRef = db.collection('turnos').doc(CATALOG_KEY);
      catalogRef.get().then(function(parentDoc) {
        if (!parentDoc.exists) return catalogRef.set({ catalogKey: CATALOG_KEY, createdAt: new Date().toISOString() });
      }).then(function() {
        var batch = db.batch();
        slots.forEach(function(slot) { batch.set(catalogRef.collection('slots').doc(), slot); });
        return batch.commit();
      }).then(function() { modal.remove(); loadAppointments(); loadStats(); alert('Se generaron ' + slots.length + ' turnos'); })
        .catch(function(error) { alert('Error al generar turnos: ' + error.message); })
        .finally(function() { submitBtn.disabled = false; submitBtn.textContent = 'Generar'; });
    };
  }

  // Tab Navigation
  function setupTabNavigation() {
    var tabs = document.querySelectorAll('.admin-tab');
    var tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        var targetTab = tab.dataset.tab;
        
        // Update active tab button
        tabs.forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        
        // Show/hide tab content
        tabContents.forEach(function(content) {
          if (content.id === 'tab-' + targetTab) {
            content.classList.add('active');
            content.style.display = 'block';
          } else {
            content.classList.remove('active');
            content.style.display = 'none';
          }
        });
      });
    });
    
    // Set initial active tab based on features
    var features = window.FEATURES || {};
    var firstActiveTab = null;
    
    if (features.appointments) {
      firstActiveTab = 'appointments';
    } else if (features.inventory) {
      firstActiveTab = 'orders';
    } else if (features.prices) {
      firstActiveTab = 'prices';
    }
    
    if (firstActiveTab) {
      var activeTabBtn = document.querySelector('.admin-tab[data-tab="' + firstActiveTab + '"]');
      if (activeTabBtn) activeTabBtn.click();
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    if (!initFirebase()) return;
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    var prevDayBtn = document.getElementById('prev-day');
    var nextDayBtn = document.getElementById('next-day');
    var todayBtn = document.getElementById('today-btn');
    var addSlotBtn = document.getElementById('add-slot-btn');
    var configBtn = document.getElementById('config-btn');
    var batchBtn = document.getElementById('batch-btn');
    if (prevDayBtn) prevDayBtn.addEventListener('click', function() { navigateDate(-1); });
    if (nextDayBtn) nextDayBtn.addEventListener('click', function() { navigateDate(1); });
    if (todayBtn) todayBtn.addEventListener('click', goToToday);
    if (addSlotBtn) addSlotBtn.addEventListener('click', openAddModal);
    if (configBtn) configBtn.addEventListener('click', openConfigModal);
    if (batchBtn) batchBtn.addEventListener('click', openBatchModal);
    if (slotForm) slotForm.addEventListener('submit', handleSlotSubmit);
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(function(btn) { btn.addEventListener('click', closeModal); });
    if (slotModal) slotModal.addEventListener('click', function(e) { if (e.target === slotModal) closeModal(); });
    
    // Setup tab navigation
    setupTabNavigation();
  });
})();