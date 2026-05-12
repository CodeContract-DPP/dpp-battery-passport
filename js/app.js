/**
 * app-battery.js - Motor generico DPP adaptado para Battery Passport
 * Basado en el motor de construccion (codecontract-dpp/dpp-construccion-demos)
 * Anade: estados confirmed/dynamic, renderizado _isTable, plazos 2027/2028
 * Soporta: JSON-LD @context, traceability, actors, registry, block_status
 * v2.0 - 2026-04-21
 */
const DPP = (() => {
  const STATUS_MAP = {
    verified:  { label: 'Aportado',           cls: 'st-confirmed', icon: '\u2705' },
    confirmed: { label: 'Aportado',           cls: 'st-confirmed', icon: '\u2705' },
    partial:   { label: 'Parcial',            cls: 'st-partial',   icon: '\u26A0\uFE0F' },
    pending:   { label: 'Por aportar',        cls: 'st-pending',   icon: '\u274C' },
    assumed:   { label: 'Por validar',        cls: 'st-assumed',   icon: '\uD83D\uDD35' },
    dynamic:   { label: 'Tiempo real (BMS)',  cls: 'st-dynamic',   icon: '\uD83D\uDCE1' }
  };
  const LEGAL_CLS = { 'LEY': 'legal-ley', 'PROYECCION': 'legal-proyeccion', 'PENDIENTE AD': 'legal-pendiente' };

  function legalClass(basis) {
    if (!basis) return '';
    for (var k in LEGAL_CLS) { if (basis.indexOf(k) >= 0) return LEGAL_CLS[k]; }
    return '';
  }
  function statusBadge(s) {
    var m = STATUS_MAP[s] || STATUS_MAP.pending;
    return '<span class="status-badge ' + m.cls + '">' + m.icon + ' ' + m.label + '</span>';
  }
  function humanKey(key) {
    return key
      .replace(/__/g, ' \u203A ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, function(c){ return c.toUpperCase(); })
      .replace(/_/g, ' ');
  }

  function renderTable(tableObj) {
    if (!tableObj || !tableObj._columns || !tableObj._rows) return '<span class="no-data">\u2014 tabla vac\u00eda \u2014</span>';
    var html = '<table class="data-table"><thead><tr>';
    tableObj._columns.forEach(function(col) {
      html += '<th>' + humanKey(col) + '</th>';
    });
    html += '</tr></thead><tbody>';
    tableObj._rows.forEach(function(row) {
      html += '<tr>';
      tableObj._columns.forEach(function(col) {
        var val = row[col];
        html += '<td>' + (val !== null && val !== undefined ? String(val) : '\u2014') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  function linkify(s) {
    if (typeof s !== 'string') return s;
    var trimmed = s.trim();
    // URL completa al inicio (http/https)
    if (/^https?:\/\/[^\s<>"']+$/i.test(trimmed)) {
      return '<a href="' + trimmed + '" target="_blank" rel="noopener" class="src-link">' + trimmed + '</a>';
    }
    // Mailto
    if (/^mailto:/i.test(trimmed)) {
      return '<a href="' + trimmed + '" class="src-link">' + trimmed.replace(/^mailto:/i,'') + '</a>';
    }
    // URL embebida dentro de texto: hacer la URL clicable conservando el resto
    return s.replace(/(https?:\/\/[^\s<>"']+)/gi, function(m){
      return '<a href="' + m + '" target="_blank" rel="noopener" class="src-link">' + m + '</a>';
    });
  }

  function formatValue(val) {
    if (val === null || val === undefined) return '<span class="no-data">\u2014 sin datos \u2014</span>';
    if (typeof val === 'object' && !Array.isArray(val) && val._isTable) {
      return renderTable(val);
    }
    if (typeof val === 'object' && !Array.isArray(val)) {
      var parts = [];
      Object.keys(val).forEach(function(k) {
        if (!k.startsWith('_')) {
          parts.push('<span class="field-name">' + humanKey(k) + ':</span> ' + formatValue(val[k]));
        }
      });
      return parts.length ? parts.join('<br>') : '<span class="no-data">\u2014 vac\u00edo \u2014</span>';
    }
    if (Array.isArray(val)) return val.length ? val.join(', ') : '<span class="no-data">\u2014 vac\u00edo \u2014</span>';
    if (typeof val === 'boolean') return val ? 'S\u00ed' : 'No';
    return linkify(String(val));
  }

  function renderAttribute(key, attr, sectionKey) {
    if (key.startsWith('_')) return '';
    var metaKeys = ['_status','_legalBasis','_sourceDocument','_evidence','_note','_isTable','_columns','_rows','_isExtension'];
    var editing = isEditMode() && attr._status !== 'dynamic';
    var dataFields = '';
    if (attr._isTable && attr._columns && attr._rows) {
      dataFields = renderTable(attr);
    } else {
      Object.keys(attr).forEach(function(k) {
        if (metaKeys.indexOf(k) >= 0) return;
        var val = attr[k];
        var path = (sectionKey || '?') + '.' + key + '.' + k;
        var valHTML;
        if (editing && (typeof val === 'string' || typeof val === 'number' || val === null) && (typeof val !== 'object' || val === null)) {
          var displayVal = (val === null || val === undefined) ? '' : String(val);
          var typeAttr = (typeof val === 'number') ? 'number' : 'string';
          valHTML = '<span class="editable-value" contenteditable="true" data-edit-path="' + path + '" data-edit-type="' + typeAttr + '" spellcheck="false">' + displayVal + '</span>';
        } else {
          valHTML = formatValue(val);
        }
        dataFields += '<span class="field-name">' + humanKey(k) + ':</span> ' + valHTML + '<br>';
      });
    }
    var status = statusBadge(attr._status);
    var lCls = legalClass(attr._legalBasis);
    var docHTML = '';
    if (attr._sourceDocument) {
      var d = attr._sourceDocument;
      docHTML = '<div class="source-doc"><span class="doc-icon">\uD83D\uDCC4</span><div class="doc-info">' +
        '<strong>' + linkify(d.name||'--') + '</strong>' +
        '<span class="doc-type">' + (d.type||'') + '</span>' +
        '<span class="doc-gen">Genera: ' + linkify(d.generatedBy||'--') + '</span>' +
        '<span class="doc-deadline">Plazo: ' + linkify(d.deadline||'--') + '</span>' +
        '</div></div>';
    }
    var evidenceHTML = '';
    if (attr._evidence) {
      var e = attr._evidence;
      if (e.blockchainTxHash) {
        var sh = e.blockchainTxHash.length > 16 ? e.blockchainTxHash.slice(0,8) + '\u2026' + e.blockchainTxHash.slice(-6) : e.blockchainTxHash;
        evidenceHTML = '<div class="trackline-badge verified"><span class="tl-icon">\u26D3\uFE0F</span><div class="tl-info">' +
          '<strong>Trackline verificado</strong>' +
          '<span class="tl-hash" title="' + e.blockchainTxHash + '">Tx: ' + sh + '</span>' +
          '<span class="tl-pid">Proceso: ' + (e.tracklineProcessId||'--') + '</span>' +
          '<span class="tl-date">Fecha: ' + (e.registeredDate||'--') + '</span>' +
          '<span class="tl-by">Por: ' + (e.registeredBy||'--') + '</span>' +
          '</div></div>';
      } else {
        evidenceHTML = '<div class="trackline-badge pending"><span class="tl-icon">\u26D3\uFE0F</span><span class="tl-pending">Sin evidencia blockchain</span></div>';
      }
    }
    var legalPill = attr._legalBasis ? '<span class="legal-pill ' + lCls + '" title="' + attr._legalBasis + '">' + attr._legalBasis + '</span>' : '';
    var noteHTML = attr._note ? '<div class="attr-note">' + attr._note + '</div>' : '';
    var extBadge = attr._isExtension ? '<span class="ext-badge" title="Extensión propietaria Code Contract — no DAL v1.3">⚙️ Trackline ext.</span>' : '';
    var extAttr = attr._isExtension ? ' data-extension="true"' : '';
    return '<div class="attribute" data-status="' + (attr._status||'pending') + '"' + extAttr + '>' +
      '<div class="attr-header"><h3>' + humanKey(key) + '</h3>' + status + extBadge + '</div>' +
      '<div class="attr-body">' +
      '<div class="attr-data">' + dataFields + '</div>' +
      legalPill + noteHTML + docHTML + evidenceHTML +
      '</div></div>';
  }

  function renderSection(sectionKey, section, extraCls) {
    var icon = section._icon || '\uD83D\uDCC1';
    var title = section._title || humanKey(sectionKey);
    var attrsHTML = '';
    var counts = { verified:0, confirmed:0, partial:0, pending:0, dynamic:0 };
    Object.keys(section).forEach(function(k) {
      if (k.startsWith('_')) return;
      attrsHTML += renderAttribute(k, section[k], sectionKey);
      var st = section[k]._status || 'pending';
      if (st === 'assumed') st = 'pending';
      counts[st] = (counts[st]||0) + 1;
    });
    var cls = extraCls ? ' ' + extraCls : '';
    var cntGreen = counts.verified + counts.confirmed;
    var cntAmber = counts.partial;
    var cntRed = counts.pending;
    var cntBlue = counts.dynamic;

    var isExtSection = (sectionKey === 'tracklineExtensions') ? ' section-extension' : '';
    return '<section class="dpp-section' + cls + isExtSection + '" id="sec-' + sectionKey + '">' +
      '<div class="section-header" onclick="DPP.toggleSection(\'' + sectionKey + '\')">' +
      '<span class="section-icon">' + icon + '</span>' +
      '<h2>' + title + '</h2>' +
      '<div class="section-counts">' +
      (cntGreen ? '<span class="cnt cnt-v" title="Verificado / Confirmado">' + cntGreen + '</span>' : '') +
      (cntAmber ? '<span class="cnt cnt-pa" title="Parcial">' + cntAmber + '</span>' : '') +
      (cntRed ? '<span class="cnt cnt-pe" title="Pendiente">' + cntRed + '</span>' : '') +
      (cntBlue ? '<span class="cnt cnt-dy" title="Din\u00e1mico (BMS)">' + cntBlue + '</span>' : '') +
      '</div>' +
      '<span class="chevron" id="chev-' + sectionKey + '">\u25B6</span>' +
      '</div>' +
      '<div class="section-body collapsed" id="body-' + sectionKey + '">' + attrsHTML + '</div>' +
      '</section>';
  }

  var SKIP_KEYS = ['@context','dpp_uid','dpp_version','created','last_updated','regulation_framework','_meta','block_status','_executiveSummary','documentRequirements'];

  function renderDocumentRequirements(data) {
    var dr = data.documentRequirements;
    if (!dr) return '';
    var c = dr.counts || {total: 0, confirmed: 0, partial: 0, pending: 0};
    var pctConfirmed = c.total ? Math.round(100 * c.confirmed / c.total) : 0;
    var pctPartial = c.total ? Math.round(100 * c.partial / c.total) : 0;

    var statusLabel = {
      'confirmed': {emoji: '✅', label: 'Tenemos', cls: 'doc-ok'},
      'partial':   {emoji: '⚠️', label: 'Parcial',  cls: 'doc-partial'},
      'pending':   {emoji: '❌', label: 'Falta',    cls: 'doc-missing'}
    };

    var html = '<section class="doc-req-block">' +
      '<div class="doc-req-header">' +
        '<h2>📑 ' + (dr.title || 'Documentos necesarios') + '</h2>' +
        (dr.subtitle ? '<p class="doc-req-sub">' + dr.subtitle + '</p>' : '') +
      '</div>' +

      '<div class="doc-req-summary">' +
        '<div class="doc-req-counter"><span class="dr-num dr-num-ok">' + c.confirmed + '</span><span class="dr-lbl">Tenemos</span></div>' +
        '<div class="doc-req-counter"><span class="dr-num dr-num-partial">' + c.partial + '</span><span class="dr-lbl">Parcial</span></div>' +
        '<div class="doc-req-counter"><span class="dr-num dr-num-missing">' + c.pending + '</span><span class="dr-lbl">Faltan</span></div>' +
        '<div class="doc-req-counter doc-req-counter-total"><span class="dr-num">' + c.total + '</span><span class="dr-lbl">Total exigibles</span></div>' +
      '</div>' +

      '<div class="doc-req-progress">' +
        '<div class="doc-req-progress-bar">' +
          '<div class="doc-req-progress-fill doc-req-progress-confirmed" style="width:' + pctConfirmed + '%"></div>' +
          '<div class="doc-req-progress-fill doc-req-progress-partial" style="width:' + pctPartial + '%"></div>' +
        '</div>' +
        '<span class="doc-req-progress-label">' + pctConfirmed + '% confirmados · ' + pctPartial + '% parciales · ' + (100-pctConfirmed-pctPartial) + '% pendientes</span>' +
      '</div>';

    if (Array.isArray(dr.documents)) {
      html += '<div class="doc-req-grid">';
      dr.documents.forEach(function(doc) {
        var st = statusLabel[doc.status] || {emoji: '•', label: doc.status, cls: ''};
        var oblBadge;
        if (doc.obligation === 'obligatory') {
          oblBadge = '<span class="doc-oblig doc-oblig-required">🔴 OBLIGATORIO</span>';
        } else if (doc.obligation === 'obligatory_reach' || doc.obligation === 'obligatory_gs1') {
          oblBadge = '<span class="doc-oblig doc-oblig-sectoral">🟠 OBLIGATORIO sectorial</span>';
        } else if (doc.obligation === 'functional_requirement') {
          oblBadge = '<span class="doc-oblig doc-oblig-functional">🔵 OBLIGACIÓN FUNCIONAL</span>';
        } else {
          oblBadge = '<span class="doc-oblig doc-oblig-recom">📌 Recomendado</span>';
        }
        html += '<div class="doc-card ' + st.cls + '" data-doc-status="' + doc.status + '">' +
          '<div class="doc-card-header">' +
            '<span class="doc-card-icon">' + (doc.icon || '📄') + '</span>' +
            '<div class="doc-card-title">' +
              '<strong>' + doc.name + '</strong>' +
              (doc.cat ? '<span class="doc-card-cat">' + doc.cat + '</span>' : '') +
            '</div>' +
            '<span class="doc-card-status">' + st.emoji + ' ' + st.label + '</span>' +
          '</div>' +
          '<div class="doc-card-body">' +
            (doc.regulatoryBasis ? '<div class="doc-card-row"><strong>Base legal:</strong> ' + doc.regulatoryBasis + ' ' + oblBadge + '</div>' : '') +
            (doc.deadline ? '<div class="doc-card-row"><strong>Plazo:</strong> ' + doc.deadline + '</div>' : '') +
            (doc.providedBy ? '<div class="doc-card-row"><strong>Lo aporta:</strong> ' + doc.providedBy + '</div>' : '') +
            (doc.note ? '<div class="doc-card-note">' + doc.note + '</div>' : '') +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    if (dr.footer_message) {
      html += '<div class="doc-req-cta">' +
        '<span class="exec-cta-icon">💡</span>' +
        '<div>' + dr.footer_message + '</div>' +
      '</div>';
    }

    html += '</section>';
    return html;
  }

  function renderExecutiveSummary(data) {
    var es = data._executiveSummary;
    if (!es) return '';
    var html = '<section class="exec-summary">' +
      '<div class="exec-summary-header">' +
        '<h2>' + (es.title || '') + '</h2>' +
        (es.subtitle ? '<p class="exec-summary-sub">' + es.subtitle + '</p>' : '') +
      '</div>';
    if (Array.isArray(es.highlights) && es.highlights.length) {
      html += '<div class="exec-summary-grid">';
      es.highlights.forEach(function(h){
        html += '<div class="exec-highlight">' +
          '<span class="exec-highlight-icon">' + (h.icon || '•') + '</span>' +
          '<div class="exec-highlight-body">' +
            '<strong>' + (h.label || '') + '</strong>' +
            '<p>' + (h.text || '') + '</p>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }
    var ctaText = es.mensaje_clave || es.trackline_aporta;
    if (ctaText) {
      html += '<div class="exec-summary-cta">' +
        '<span class="exec-cta-icon">💡</span>' +
        '<div>' + ctaText + '</div>' +
      '</div>';
    }
    html += '</section>';
    return html;
  }

  function renderMeta(data) {
    var meta = data._meta || {};
    var productName = '';
    if (meta.notes) productName = '<div class="meta-row"><strong>\uD83D\uDCCB</strong> ' + meta.notes + '</div>';
    var infraHTML = '';
    if (data.dpp_uid) infraHTML += '<div class="meta-row"><strong>DPP UID:</strong> <code>' + data.dpp_uid + '</code></div>';
    if (data['@context']) infraHTML += '<div class="meta-row"><strong>JSON-LD @context:</strong> ' + data['@context'] + '</div>';
    if (data.regulation_framework) infraHTML += '<div class="meta-row"><strong>Marco regulatorio:</strong> ' + data.regulation_framework.join(' \u00b7 ') + '</div>';
    return '<div class="dpp-meta">' +
      productName +
      '<div class="meta-row"><strong>Esquema:</strong> ' + (meta.schema||'--') + '</div>' +
      '<div class="meta-row"><strong>Regulaci\u00f3n:</strong> ' + (meta.regulation||'--') + '</div>' +
      '<div class="meta-row"><strong>Versi\u00f3n:</strong> ' + (meta.version||'--') + ' \u2014 ' + (meta.generatedDate||'--') + '</div>' +
      ((meta.dppStatus&&meta.dppStatus.value)||(meta.dppGranularity&&meta.dppGranularity.value) ? '<div class="meta-row"><strong>Estado DPP:</strong> ' + (meta.dppStatus&&meta.dppStatus.value||'--') + ' \u00b7 Granularidad: ' + (meta.dppGranularity&&meta.dppGranularity.value||'--') + '</div>' : '') +
      '<div class="meta-row"><strong>Evidencia:</strong> ' + (meta.evidenceProvider||'--') + '</div>' +
      infraHTML +
      '</div>';
  }

  function renderSummary(data) {
    var total=0, verified=0, confirmed=0, partial=0, pending=0, dynamic=0;
    var urgentItems = [];
    var tracklineCount = 0;
    Object.keys(data).forEach(function(sk) {
      if (SKIP_KEYS.indexOf(sk) >= 0) return;
      if (typeof data[sk] !== 'object' || data[sk] === null || Array.isArray(data[sk])) return;
      Object.keys(data[sk]).forEach(function(ak) {
        if (ak.startsWith('_')) return;
        total++;
        var attr = data[sk][ak];
        var st = attr._status;
        if (st === 'verified') verified++;
        else if (st === 'confirmed') confirmed++;
        else if (st === 'partial') partial++;
        else if (st === 'assumed') pending++;
        else if (st === 'dynamic') dynamic++;
        else pending++;
        if (attr._evidence && attr._evidence.blockchainTxHash) tracklineCount++;
        if (attr._sourceDocument && attr._sourceDocument.deadline) {
          var dl = attr._sourceDocument.deadline;
          if ((dl.indexOf('2026') >= 0 || dl.indexOf('2027') >= 0 || dl.indexOf('2028') >= 0) && st !== 'verified' && st !== 'confirmed') {
            urgentItems.push({name: humanKey(ak), deadline: dl, section: data[sk]._title || sk});
          }
        }
      });
    });
    var completados = verified + confirmed;
    var pct = total ? Math.round((completados/total)*100) : 0;
    var pctPartial = total ? Math.round(((completados+partial)/total)*100) : 0;
    var dashLen = Math.PI * 100;
    var dashOff = dashLen * (1 - pct/100);

    var urgentHTML = '';
    if (urgentItems.length > 0) {
      urgentHTML = '<div class="dashboard-urgent"><strong>\u26A0\uFE0F Plazos regulatorios:</strong><ul>';
      urgentItems.slice(0, 8).forEach(function(item) {
        urgentHTML += '<li><strong>' + item.name + '</strong> \u2014 ' + item.deadline + ' <span class="urgent-section">(' + item.section + ')</span></li>';
      });
      if (urgentItems.length > 8) urgentHTML += '<li>... y ' + (urgentItems.length - 8) + ' m\u00e1s</li>';
      urgentHTML += '</ul></div>';
    }

    return '<div class="dpp-dashboard">' +
      '<div class="dashboard-header"><h2>\uD83D\uDCCA Panel ejecutivo \u2014 Battery Passport</h2></div>' +
      '<div class="dashboard-grid">' +
      '<div class="dashboard-ring">' +
      '<svg viewBox="0 0 120 120">' +
      '<circle cx="60" cy="60" r="50" class="ring-bg"/>' +
      '<circle cx="60" cy="60" r="50" class="ring-fill" stroke-dasharray="' + dashLen + '" stroke-dashoffset="' + dashOff + '"/>' +
      '</svg>' +
      '<span class="ring-label">' + pct + '%</span>' +
      '</div>' +
      '<div class="dashboard-stats">' +
      '<div class="stat"><span class="dot dot-v"></span> Confirmados: <strong>' + confirmed + '</strong></div>' +
      '<div class="stat"><span class="dot dot-ve"></span> Verificados: <strong>' + verified + '</strong></div>' +
      '<div class="stat"><span class="dot dot-pa"></span> Parciales: <strong>' + partial + '</strong></div>' +
      '<div class="stat"><span class="dot dot-dy"></span> Din\u00e1micos (BMS): <strong>' + dynamic + '</strong></div>' +
      '<div class="stat"><span class="dot dot-pe"></span> Pendientes: <strong>' + pending + '</strong></div>' +
      '<div class="stat-total">Total: ' + total + ' atributos \u00b7 Completados: ' + completados + ' (' + pct + '%) \u00b7 Cobertura: ' + pctPartial + '%</div>' +
      '</div>' +
      '<div class="dashboard-kpis">' +
      '<div class="kpi"><span class="kpi-number">' + tracklineCount + '</span><span class="kpi-label">\u26D3\uFE0F Trackline</span></div>' +
      '<div class="kpi"><span class="kpi-number">' + urgentItems.length + '</span><span class="kpi-label">\u26A0\uFE0F Plazos</span></div>' +
      '<div class="kpi"><span class="kpi-number">' + dynamic + '</span><span class="kpi-label">\uD83D\uDCE1 BMS</span></div>' +
      '<div class="kpi"><span class="kpi-number">' + pending + '</span><span class="kpi-label">\u274C Sin datos</span></div>' +
      '</div>' +
      '</div>' +
      urgentHTML +
      '</div>';
  }

  async function init(jsonPath, containerId) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[DPP] Contenedor no encontrado:', containerId);
      return;
    }
    container.innerHTML = '<div class="loading">Cargando Battery Passport\u2026</div>';
    try {
      var res = await fetch(jsonPath, { cache: 'no-cache' });
      if (!res.ok) throw new Error('No se pudo descargar ' + jsonPath + ' (HTTP ' + res.status + ')');
      var data = await res.json();
      applyEditsToData(data);
      window._dppData = data;
      var html = renderEditBanner(data) + renderMeta(data) + renderSummary(data) + renderExecutiveSummary(data) + renderDocumentRequirements(data);

      // Barra de filtros antes de las secciones, en <details> colapsable
      html += '<details class="filter-bar-wrapper">' +
        '<summary class="filter-bar-summary">\uD83D\uDD0D Filtrar campos</summary>' +
        '<div class="filter-bar">' +
          '<button class="filter-btn active" data-filter="all">Todos</button>' +
          '<button class="filter-btn" data-filter="confirmed">\u2705 Aportado</button>' +
          '<button class="filter-btn" data-filter="dynamic">\uD83D\uDCE1 Tiempo real (BMS)</button>' +
          '<button class="filter-btn" data-filter="pending">\u274C Por aportar</button>' +
        '</div>' +
      '</details>';

      if (data.registry) {
        html += renderSection('registry', data.registry, 'registry-highlight');
      }

      Object.keys(data).forEach(function(k) {
        if (SKIP_KEYS.indexOf(k) >= 0 || k === 'registry') return;
        if (typeof data[k] !== 'object' || data[k] === null || Array.isArray(data[k])) return;
        html += renderSection(k, data[k], '');
      });
      container.innerHTML = html;
      bindFilters();
      bindEditMode();
      bindEditableInputs();
    } catch(err) {
      console.error('[DPP] Error cargando datos:', err);
      container.innerHTML = '<div class="error">' +
        '<strong>\u26A0\uFE0F Error cargando el Battery Passport</strong><br>' +
        '<span style="font-size:.9rem">' + err.message + '</span><br>' +
        '<span style="font-size:.8rem;color:#718096;display:block;margin-top:.5rem">' +
        'Revisa la consola del navegador (F12) para m\u00e1s detalles, o prueba a recargar con Ctrl+F5.' +
        '</span></div>';
    }
  }

  function autoInit() {
    var container = document.getElementById('dpp-root');
    if (!container) return;
    if (container.children.length > 0) return;
    var sel = document.getElementById('jsonFile');
    var jsonPath = sel ? sel.value : 'data/dpp-battery-lmt-lfp.json';
    init(jsonPath, 'dpp-root');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    setTimeout(autoInit, 0);
  }

  function bindFilters() {
    document.querySelectorAll('.filter-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.filter-btn').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        var f = btn.dataset.filter;
        document.querySelectorAll('.attribute').forEach(function(el) {
          if (f === 'all') { el.style.display = ''; return; }
          el.style.display = (el.dataset.status === f) ? '' : 'none';
        });
      });
    });
  }

  function toggleSection(key) {
    var body = document.getElementById('body-' + key);
    var chev = document.getElementById('chev-' + key);
    if (body.classList.contains('collapsed')) {
      body.classList.remove('collapsed');
      chev.textContent = '\u25BC';
    } else {
      body.classList.add('collapsed');
      chev.textContent = '\u25B6';
    }
  }


  // ============================================================
  // MÓDULO DE EDICIÓN (solo activo en ?product=dpp-battery-beeplanet)
  // ============================================================
  var EDITABLE_PRODUCTS = ['dpp-battery-beeplanet'];

  function getProductId() {
    return new URLSearchParams(window.location.search).get('product') || 'default';
  }
  function isEditableProduct() {
    return EDITABLE_PRODUCTS.indexOf(getProductId()) >= 0;
  }
  function isEditMode() {
    if (!isEditableProduct()) return false;
    return localStorage.getItem('dpp-edit-mode-' + getProductId()) === 'on';
  }
  function setEditMode(on) {
    localStorage.setItem('dpp-edit-mode-' + getProductId(), on ? 'on' : 'off');
  }
  function loadEdits() {
    try { return JSON.parse(localStorage.getItem('dpp-edits-' + getProductId()) || '{}'); }
    catch(e) { return {}; }
  }
  function saveEdit(path, value) {
    var edits = loadEdits();
    if (value === '' || value === null) { delete edits[path]; }
    else { edits[path] = value; }
    localStorage.setItem('dpp-edits-' + getProductId(), JSON.stringify(edits));
  }
  function clearEdits() {
    localStorage.removeItem('dpp-edits-' + getProductId());
  }

  function applyEditsToData(data) {
    if (!isEditableProduct()) return;
    var edits = loadEdits();
    Object.keys(edits).forEach(function(path) {
      var parts = path.split('.');
      var node = data;
      for (var i = 0; i < parts.length - 1; i++) {
        if (node && typeof node === 'object') { node = node[parts[i]]; }
      }
      if (node && typeof node === 'object' && parts[parts.length-1] in node) {
        node[parts[parts.length-1]] = edits[path];
      }
    });
    Object.keys(edits).forEach(function(path) {
      var parts = path.split('.');
      if (parts[parts.length-1] !== 'value') return;
      var parentPath = parts.slice(0, -1);
      var node = data;
      for (var i = 0; i < parentPath.length; i++) { node = node[parentPath[i]]; }
      if (node && typeof node === 'object' && node._status !== 'dynamic') {
        var v = edits[path];
        node._status = (v !== null && v !== '' && v !== undefined) ? 'confirmed' : 'pending';
      }
    });
  }

  function computeStats(data) {
    var s = { confirmed: 0, pending: 0, dynamic: 0, partial: 0, assumed: 0, total: 0 };
    function walk(node) {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (typeof node !== 'object' || node === null) return;
      if (typeof node._status === 'string') {
        s.total++;
        if (s[node._status] !== undefined) s[node._status]++;
      }
      Object.keys(node).forEach(function(k){ walk(node[k]); });
    }
    walk(data);
    return s;
  }

  function renderEditBanner(data) {
    if (!isEditableProduct()) return '';
    var on = isEditMode();
    var stats = computeStats(data);
    return '<div class="edit-banner ' + (on ? 'edit-banner-on' : '') + '">' +
      '<div class="edit-banner-left">' +
        '<label class="edit-toggle">' +
          '<input type="checkbox" id="edit-mode-toggle" ' + (on ? 'checked' : '') + '>' +
          '<span class="edit-toggle-slider"></span>' +
          '<span class="edit-toggle-label">\uD83D\uDCDD Modo edici\u00f3n</span>' +
        '</label>' +
        (on ? '<span class="edit-hint">Click sobre cualquier valor para editarlo. Se guarda solo en tu navegador.</span>' : '<span class="edit-hint">Activa el toggle para rellenar valores. Tu progreso se guarda en este navegador.</span>') +
      '</div>' +
      '<div class="edit-banner-right">' +
        '<span class="edit-progress">\uD83D\uDCCA <strong>' + stats.confirmed + '</strong> aportados \u00b7 <strong>' + stats.pending + '</strong> por aportar \u00b7 <strong>' + stats.dynamic + '</strong> din\u00e1micos \u00b7 <strong>' + stats.total + '</strong> total</span>' +
        (on ? '<button class="edit-reset-btn" onclick="DPP.resetEdits()" title="Borra todos los valores que hayas introducido">\uD83D\uDD04 Empezar de cero</button>' : '') +
      '</div>' +
    '</div>';
  }

  function bindEditMode() {
    var toggle = document.getElementById('edit-mode-toggle');
    if (toggle) {
      toggle.addEventListener('change', function() {
        setEditMode(toggle.checked);
        location.reload();
      });
    }
  }

  function bindEditableInputs() {
    document.querySelectorAll('.editable-value').forEach(function(el) {
      el.addEventListener('blur', commitEdit);
      el.addEventListener('keydown', function(e){
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
      });
    });
  }

  function commitEdit(e) {
    var el = e.target;
    var path = el.getAttribute('data-edit-path');
    var newValue = el.textContent.trim();
    var type = el.getAttribute('data-edit-type') || 'string';
    var typed = newValue;
    if (type === 'number') {
      typed = newValue === '' ? null : Number(newValue);
      if (isNaN(typed)) typed = newValue;
    }
    saveEdit(path, typed);
    setTimeout(function(){
      var attr = el.closest('.attribute');
      if (attr) {
        var newStatus = (typed !== null && typed !== '') ? 'confirmed' : 'pending';
        if (attr.getAttribute('data-status') !== 'dynamic') {
          attr.setAttribute('data-status', newStatus);
          var badge = attr.querySelector('.status-badge');
          if (badge) {
            badge.className = 'status-badge ' + STATUS_MAP[newStatus].cls;
            badge.innerHTML = STATUS_MAP[newStatus].icon + ' ' + STATUS_MAP[newStatus].label;
          }
        }
      }
    }, 0);
  }

  function resetEdits() {
    if (!confirm('\u00bfEst\u00e1s seguro de borrar todos los valores introducidos en este DPP? Esta acci\u00f3n no se puede deshacer.')) return;
    clearEdits();
    location.reload();
  }

  return { init: init, toggleSection: toggleSection, resetEdits: resetEdits };
})();
