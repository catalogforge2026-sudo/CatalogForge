/**
 * Appointments / Booking System
 * Client-side booking functionality with Firebase integration
 * VERSION: 2026-01-29-v13 - WhatsApp inmediato al confirmar
 */

(function() {
  'use strict';
  
  console.log('Appointments.js v13 loaded - WhatsApp inmediato');

  var FIREBASE_CONFIG = window.FIREBASE_CONFIG || null;
  var CATALOG_KEY = window.CATALOG_DATA && window.CATALOG_DATA.catalog ? window.CATALOG_DATA.catalog.publicKey : '';
  if (!CATALOG_KEY && window.CATALOG_DATA && window.CATALOG_DATA.meta) {
    CATALOG_KEY = window.CATALOG_DATA.meta.clientKey || '';
  }
  var APPOINTMENT_CONFIG = window.APPOINTMENT_CONFIG || {
    slotDuration: 60,
    advanceDays: 30,
    requirePhone: true,
    requireEmail: false,
    confirmationMessage: '¡Tu turno ha sido reservado!'
  };

  var db = null;
  var selectedDate = null;
  var selectedTime = null;
  var selectedService = null;
  var selectedSlot = null;
  var selectedResource = null;
  var currentMonth = new Date();
  
  // Configuración cargada desde Firestore
  var catalogConfig = {
    mode: 'individual',
    resources: []
  };

  function initFirebase() {
    console.log('Iniciando Firebase...');
    console.log('CATALOG_KEY:', CATALOG_KEY);
    
    if (!FIREBASE_CONFIG) {
      console.warn('Firebase config not found');
      return Promise.resolve(false);
    }

    try {
      if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded');
        return Promise.resolve(false);
      }

      if (firebase.apps.length > 0) {
        console.log('Firebase ya inicializado');
      } else {
        firebase.initializeApp(FIREBASE_CONFIG);
        console.log('Firebase inicializado');
      }
      
      db = firebase.firestore();
      console.log('Firestore conectado');
      
      // Cargar configuración del catálogo
      return loadCatalogConfig().then(function() {
        return true;
      });
    } catch (error) {
      console.error('Error Firebase:', error);
      return Promise.resolve(false);
    }
  }

  function loadCatalogConfig() {
    if (!db || !CATALOG_KEY) return Promise.resolve();
    
    return db.collection('turnos').doc(CATALOG_KEY).get()
      .then(function(doc) {
        if (doc.exists && doc.data().config) {
          catalogConfig = doc.data().config;
          console.log('Config cargada:', catalogConfig.mode, 'recursos:', catalogConfig.resources?.length || 0);
        }
      })
      .catch(function(err) {
        console.warn('Error cargando config:', err);
      });
  }

  function addBookingButtons() {
    var cards = document.querySelectorAll('.item-card, .item-row');
    console.log('Cards encontradas:', cards.length);
    
    cards.forEach(function(card) {
      if (card.querySelector('.book-btn')) return;
      var itemId = card.dataset.itemId;
      if (!itemId) return;

      var btn = document.createElement('button');
      btn.className = 'book-btn';
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Reservar';
      
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openBookingModal({
          id: itemId,
          name: card.dataset.itemName,
          price: card.dataset.itemPrice
        });
      });

      var priceEl = card.querySelector('.item-price, .price');
      if (priceEl) {
        priceEl.parentNode.insertBefore(btn, priceEl.nextSibling);
      } else {
        card.appendChild(btn);
      }
    });
  }

  function openBookingModal(service) {
    selectedService = service;
    selectedDate = null;
    selectedTime = null;
    selectedSlot = null;
    
    console.log('Abriendo modal para servicio:', service);

    var existing = document.querySelector('.booking-modal-overlay');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.className = 'booking-modal-overlay';
    modal.innerHTML = 
      '<div class="booking-modal">' +
        '<div class="booking-modal-header">' +
          '<h3>Reservar Turno</h3>' +
          '<button class="booking-modal-close">&times;</button>' +
        '</div>' +
        '<div class="booking-modal-body">' +
          '<div class="booking-service-info">' +
            '<strong>' + (service.name || 'Servicio') + '</strong>' +
          '</div>' +
          '<div class="booking-calendar">' +
            '<div class="booking-calendar-header">' +
              '<h4>Selecciona fecha</h4>' +
              '<div class="booking-calendar-nav">' +
                '<button class="prev-month">&lsaquo;</button>' +
                '<button class="next-month">&rsaquo;</button>' +
              '</div>' +
            '</div>' +
            '<div class="booking-calendar-grid" id="calendar-grid"></div>' +
          '</div>' +
          '<div class="booking-time-slots" style="display:none">' +
            '<h4>Horarios disponibles</h4>' +
            '<div class="booking-time-grid" id="time-grid"></div>' +
          '</div>' +
          '<form class="booking-form" style="display:none">' +
            '<div class="booking-form-group">' +
              '<label>Nombre *</label>' +
              '<input type="text" name="name" required>' +
            '</div>' +
            '<div class="booking-form-group">' +
              '<label>Telefono *</label>' +
              '<input type="tel" name="phone" required>' +
            '</div>' +
            '<button type="submit" class="booking-submit">Confirmar Reserva</button>' +
          '</form>' +
          '<div class="booking-success" style="display:none">' +
            '<h3>¡Reserva Confirmada!</h3>' +
            '<p>' + APPOINTMENT_CONFIG.confirmationMessage + '</p>' +
            '<button class="booking-submit booking-close-btn">Cerrar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    
    modal.querySelector('.booking-modal-close').onclick = function() { modal.remove(); };
    modal.querySelector('.booking-close-btn').onclick = function() { modal.remove(); };
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
    modal.querySelector('.prev-month').onclick = function() { navigateMonth(-1); };
    modal.querySelector('.next-month').onclick = function() { navigateMonth(1); };
    modal.querySelector('.booking-form').onsubmit = handleBookingSubmit;

    setTimeout(function() {
      modal.classList.add('active');
      renderCalendar(new Date());
    }, 10);
  }

  function formatDateLocal(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }
  
  function renderCalendar(date) {
    currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    var grid = document.getElementById('calendar-grid');
    if (!grid) return;

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + APPOINTMENT_CONFIG.advanceDays);

    var year = currentMonth.getFullYear();
    var month = currentMonth.getMonth();
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();

    var header = document.querySelector('.booking-calendar-header h4');
    if (header) {
      var months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      header.textContent = months[month] + ' ' + year;
    }

    var dayNames = ['DOM','LUN','MAR','MIE','JUE','VIE','SAB'];
    var html = '';
    for (var i = 0; i < dayNames.length; i++) {
      html += '<div class="booking-calendar-day-header">' + dayNames[i] + '</div>';
    }
    
    for (var j = 0; j < firstDay; j++) {
      html += '<div class="booking-calendar-day disabled"></div>';
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var d = new Date(year, month, day);
      var isPast = d < today;
      var isTooFar = d > maxDate;
      var isToday = d.getTime() === today.getTime();
      var isSelected = selectedDate && d.getTime() === selectedDate.getTime();
      var cls = 'booking-calendar-day';
      if (isToday) cls += ' today';
      if (isPast || isTooFar) cls += ' disabled';
      if (isSelected) cls += ' selected';
      html += '<div class="' + cls + '" data-date="' + formatDateLocal(d) + '">' + day + '</div>';
    }

    grid.innerHTML = html;
    grid.querySelectorAll('.booking-calendar-day:not(.disabled)').forEach(function(el) {
      el.onclick = function() {
        var parts = el.dataset.date.split('-');
        selectDate(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
      };
    });
  }

  function navigateMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    renderCalendar(currentMonth);
  }

  function selectDate(date) {
    selectedDate = date;
    selectedTime = null;
    selectedSlot = null;
    var dateStr = formatDateLocal(date);
    document.querySelectorAll('.booking-calendar-day').forEach(function(el) {
      el.classList.toggle('selected', el.dataset.date === dateStr);
    });
    loadAvailableSlots(date);
  }

  function loadAvailableSlots(date) {
    var container = document.querySelector('.booking-time-slots');
    var grid = document.getElementById('time-grid');
    
    if (!container || !grid) return;

    container.style.display = 'block';
    grid.innerHTML = '<div class="booking-loading"><div class="booking-spinner"></div><p>Cargando horarios...</p></div>';

    var dateStr = formatDateLocal(date);
    console.log('Buscando slots para:', dateStr, 'Modo:', catalogConfig.mode);
    
    if (!db || !CATALOG_KEY) {
      console.warn('No hay conexion a Firestore o falta CATALOG_KEY');
      grid.innerHTML = '<p class="no-slots-message">No hay horarios disponibles.</p>';
      return;
    }

    db.collection('turnos').doc(CATALOG_KEY).collection('slots')
      .where('date', '==', dateStr).get()
      .then(function(snapshot) {
        console.log('Slots encontrados en Firestore:', snapshot.size);
        
        var slots = [];
        snapshot.forEach(function(doc) {
          var data = doc.data();
          slots.push({ 
            id: doc.id, 
            time: data.time, 
            status: data.status, 
            serviceName: data.serviceName,
            serviceId: data.serviceId,
            resourceId: data.resourceId,
            resourceName: data.resourceName
          });
        });

        var now = new Date();
        var todayStr = formatDateLocal(now);
        var isToday = dateStr === todayStr;
        var currentMin = now.getHours() * 60 + now.getMinutes();
        
        var available = [];
        
        if (catalogConfig.mode === 'multi-resource') {
          // MODO MULTI-RECURSO: Agrupar por recurso, cada recurso es independiente
          var slotsByResource = {};
          
          slots.forEach(function(s) {
            if (s.status !== 'available') return;
            
            // Filtrar por horario si es hoy
            if (isToday && s.time) {
              var parts = s.time.split(':');
              var h = parseInt(parts[0]);
              var m = parseInt(parts[1]);
              if (h * 60 + m <= currentMin + 15) return;
            }
            
            // Filtrar por servicio si aplica
            if (s.serviceId && selectedService && selectedService.id) {
              if (String(s.serviceId) !== String(selectedService.id)) return;
            }
            
            // Agrupar por recurso
            var resKey = s.resourceId || 'sin-recurso';
            if (!slotsByResource[resKey]) {
              slotsByResource[resKey] = [];
            }
            slotsByResource[resKey].push(s);
          });
          
          // Aplanar todos los slots disponibles
          Object.keys(slotsByResource).forEach(function(resKey) {
            available = available.concat(slotsByResource[resKey]);
          });
          
        } else {
          // MODO INDIVIDUAL: Un horario ocupado bloquea todos los servicios
          var occupiedTimes = {};
          slots.forEach(function(s) {
            if (s.status === 'booked' || s.status === 'confirmed') {
              occupiedTimes[s.time] = true;
            }
          });
          
          available = slots.filter(function(s) {
            if (s.status !== 'available') return false;
            
            // Si hay otro slot reservado en este horario, no mostrar
            if (occupiedTimes[s.time]) return false;
            
            // Filtrar por horario si es hoy
            if (isToday && s.time) {
              var parts = s.time.split(':');
              var h = parseInt(parts[0]);
              var m = parseInt(parts[1]);
              if (h * 60 + m <= currentMin + 15) return false;
            }
            
            // Filtrar por servicio
            if (s.serviceId && selectedService && selectedService.id) {
              if (String(s.serviceId) !== String(selectedService.id)) return false;
            }
            
            return true;
          });
        }

        console.log('Total disponibles:', available.length);

        if (available.length > 0) {
          available.sort(function(a, b) { 
            // Ordenar por hora, luego por recurso
            var timeCompare = a.time.localeCompare(b.time);
            if (timeCompare !== 0) return timeCompare;
            return (a.resourceName || '').localeCompare(b.resourceName || '');
          });
          
          var html = '';
          for (var i = 0; i < available.length; i++) {
            var s = available[i];
            var displayLabel = s.serviceName || '';
            if (catalogConfig.mode === 'multi-resource' && s.resourceName) {
              displayLabel = s.resourceName + (s.serviceName ? ' - ' + s.serviceName : '');
            }
            
            html += '<div class="booking-time-slot" data-time="' + s.time + '" data-slot-id="' + s.id + '" data-service="' + (s.serviceName || '') + '" data-resource="' + (s.resourceId || '') + '">';
            html += '<span class="slot-time">' + s.time + '</span>';
            if (displayLabel) {
              html += '<span class="slot-service">' + displayLabel + '</span>';
            }
            html += '</div>';
          }
          
          grid.innerHTML = html;
          
          grid.querySelectorAll('.booking-time-slot').forEach(function(el) {
            el.onclick = function() {
              selectTimeSlot(el.dataset.time, el.dataset.slotId, el.dataset.service, el.dataset.resource);
            };
          });
        } else {
          grid.innerHTML = '<p class="no-slots-message">No hay horarios disponibles para este servicio.<br><small>Los turnos deben ser creados desde el panel de administración.</small></p>';
        }
      })
      .catch(function(err) {
        console.error('Error cargando slots:', err);
        grid.innerHTML = '<p style="color:red;text-align:center;">Error al cargar horarios</p>';
      });
  }

  function selectTimeSlot(time, slotId, serviceName, resourceId) {
    selectedTime = time;
    selectedSlot = slotId ? { id: slotId, serviceName: serviceName } : null;
    selectedResource = resourceId || null;
    document.querySelectorAll('.booking-time-slot').forEach(function(el) {
      el.classList.toggle('selected', el.dataset.time === time && el.dataset.slotId === slotId);
    });
    var form = document.querySelector('.booking-form');
    if (form) {
      form.style.display = 'block';
      var input = form.querySelector('input');
      if (input) input.focus();
    }
  }

  function handleBookingSubmit(e) {
    e.preventDefault();
    if (!selectedDate || !selectedTime) {
      alert('Selecciona fecha y horario');
      return;
    }

    var form = e.target;
    var btn = form.querySelector('.booking-submit');
    btn.disabled = true;
    btn.textContent = 'Reservando...';

    var fd = new FormData(form);
    var clientName = fd.get('name');
    var clientPhone = fd.get('phone');
    
    var bookingData = {
      clientName: clientName,
      clientPhone: clientPhone,
      status: 'booked',
      bookedAt: new Date().toISOString()
    };

    if (!db || !CATALOG_KEY || !selectedSlot || !selectedSlot.id) {
      alert('Error de configuracion');
      btn.disabled = false;
      btn.textContent = 'Confirmar Reserva';
      return;
    }

    var ref = db.collection('turnos').doc(CATALOG_KEY).collection('slots').doc(selectedSlot.id);
    
    db.runTransaction(function(tx) {
      return tx.get(ref).then(function(doc) {
        if (!doc.exists) throw new Error('No existe');
        if (doc.data().status !== 'available') throw new Error('TAKEN');
        var updateData = Object.assign({}, doc.data(), bookingData, { updatedAt: new Date().toISOString() });
        tx.update(ref, updateData);
        return doc.data(); // Retornar datos del slot para el mensaje
      });
    })
    .then(function(slotData) {
      // Preparar datos para WhatsApp
      var whatsappData = {
        clientName: clientName,
        clientPhone: clientPhone,
        date: selectedDate,
        time: selectedTime,
        serviceName: selectedService ? selectedService.name : (slotData.serviceName || 'Turno'),
        resourceName: slotData.resourceName || null
      };
      
      // Abrir WhatsApp INMEDIATAMENTE
      openWhatsAppNotification(whatsappData);
      
      // Cerrar el modal
      var modal = document.querySelector('.booking-modal-overlay');
      if (modal) modal.remove();
    })
    .catch(function(err) {
      console.error(err);
      if (err.message === 'TAKEN') {
        alert('Este turno ya fue reservado por otra persona');
        loadAvailableSlots(selectedDate);
        form.style.display = 'none';
      } else {
        alert('Error al reservar. Intenta de nuevo.');
      }
      btn.disabled = false;
      btn.textContent = 'Confirmar Reserva';
    });
  }
  
  // Abrir WhatsApp inmediatamente para notificar al dueño
  function openWhatsAppNotification(booking) {
    // Obtener número de teléfono del dueño
    var ownerPhone = null;
    if (window.CATALOG_DATA && window.CATALOG_DATA.client) {
      ownerPhone = window.CATALOG_DATA.client.phone;
    }
    
    if (!ownerPhone) {
      console.log('No hay número de WhatsApp configurado');
      alert('¡Reserva confirmada! El negocio no tiene WhatsApp configurado.');
      return;
    }
    
    // Limpiar número de teléfono
    var cleanPhone = ownerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      console.log('Número de WhatsApp inválido');
      alert('¡Reserva confirmada!');
      return;
    }
    
    // Formatear fecha
    var dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    var dateStr = booking.date.toLocaleDateString('es-AR', dateOptions);
    
    // Construir mensaje de WhatsApp
    var catalogName = '';
    if (window.CATALOG_DATA && window.CATALOG_DATA.catalog) {
      catalogName = window.CATALOG_DATA.catalog.name || '';
    }
    
    var message = '📅 *Nueva Reserva de Turno*\n';
    message += '━━━━━━━━━━━━━━━━━━\n\n';
    if (catalogName) {
      message += '🏪 *' + catalogName + '*\n\n';
    }
    message += '👤 *Cliente:* ' + booking.clientName + '\n';
    message += '📱 *Teléfono:* ' + booking.clientPhone + '\n\n';
    message += '📆 *Fecha:* ' + dateStr + '\n';
    message += '⏰ *Hora:* ' + booking.time + '\n';
    message += '💅 *Servicio:* ' + booking.serviceName + '\n';
    if (booking.resourceName) {
      message += '👤 *Atendido por:* ' + booking.resourceName + '\n';
    }
    message += '\n━━━━━━━━━━━━━━━━━━\n';
    message += '_Reserva realizada desde el catálogo digital_';
    
    // Abrir WhatsApp
    var whatsappUrl = 'https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(message);
    window.open(whatsappUrl, '_blank');
  }

  document.addEventListener('DOMContentLoaded', function() {
    if (!window.APPOINTMENTS_ENABLED) {
      console.log('Appointments deshabilitado');
      return;
    }
    
    console.log('Inicializando appointments...');
    console.log('CATALOG_KEY:', CATALOG_KEY);
    
    initFirebase().then(function(ok) {
      console.log('Firebase inicializado:', ok);
      if (ok) {
        addBookingButtons();
        console.log('Botones de reserva agregados');
      }
    });
  });
})();
