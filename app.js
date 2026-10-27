/**
 * Nivora Care - Hospital Management System Logic
 * Vanilla JavaScript + LocalStorage
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'nivora_care_data';
  const today = new Date();

  // Date and formatting helpers
  const fmtDate = d => {
    if (!d) return '—';
    const x = new Date(d + 'T12:00:00');
    return isNaN(x)
      ? '—'
      : x.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
  };

  const iso = d => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };

  const money = n =>
    'Tk ' + Number(n || 0).toLocaleString('en-BD', {
      maximumFractionDigits: 0
    });

  const esc = s =>
    String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));

  const uid = prefix =>
    prefix + '-' + Math.floor(1000 + Math.random() * 9000);

  // Seed catalog
  const doctorsSeed = [
    { id: 'D-001', name: 'Dr. Amina Rahman', specialty: 'Internal Medicine' },
    { id: 'D-002', name: 'Dr. Farid Hasan', specialty: 'Cardiology' },
    { id: 'D-003', name: 'Dr. Nusrat Jahan', specialty: 'Paediatrics' },
    { id: 'D-004', name: 'Dr. Imran Kabir', specialty: 'Orthopaedics' },
    { id: 'D-005', name: 'Dr. Samira Chowdhury', specialty: 'Gynaecology' }
  ];

  const catalogSeed = [
    { id: 'T-001', name: 'Complete Blood Count (CBC)', price: 650 },
    { id: 'T-002', name: 'Blood Glucose', price: 350 },
    { id: 'T-003', name: 'Lipid Profile', price: 1100 },
    { id: 'T-004', name: 'Liver Function Test', price: 1250 },
    { id: 'T-005', name: 'Kidney Function Test', price: 1000 },
    { id: 'T-006', name: 'Thyroid Function Test', price: 1350 },
    { id: 'T-007', name: 'Urine Routine Examination', price: 400 }
  ];

  const blankData = () => ({
    patients: [],
    doctors: doctorsSeed.map(x => ({ ...x })),
    visits: [],
    catalog: catalogSeed.map(x => ({ ...x })),
    orders: [],
    payments: []
  });

  function readDB() {
    try {
      const d = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || 'null'
      );

      if (!d || !Array.isArray(d.patients)) {
        return blankData();
      }

      const base = blankData();

      return {
        ...base,
        ...d,
        patients: Array.isArray(d.patients) ? d.patients : [],
        doctors: Array.isArray(d.doctors) && d.doctors.length
          ? d.doctors
          : base.doctors,
        visits: Array.isArray(d.visits) ? d.visits : [],
        catalog: Array.isArray(d.catalog) && d.catalog.length
          ? d.catalog
          : base.catalog,
        orders: Array.isArray(d.orders) ? d.orders : [],
        payments: Array.isArray(d.payments) ? d.payments : []
      };
    } catch (_) {
      return blankData();
    }
  }

  let db = readDB();
  let currentView = 'overview';
  let sessionApiKey = '';
  let activeReport = 'collection';
  let searchQuery = '';

  let reportFrom = iso(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  let reportTo = iso(today);

  function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;

    el.textContent = msg;
    el.classList.add('show');

    setTimeout(() => {
      el.classList.remove('show');
    }, 2500);
  }

  const navItems = [
    ['overview', '⌂', 'Overview'],
    ['patients', '♙', 'Patients'],
    ['visits', '✚', 'Doctors & Visits'],
    ['lab', '◉', 'Laboratory'],
    ['billing', '▤', 'Billing'],
    ['reports', '▥', 'Reports'],
    ['assistant', '✳', 'AI Assistant'],
    ['settings', '⚙', 'Settings']
  ];

  function patientName(id) {
    return db.patients.find(p => p.id === id)?.name
      || 'Unknown Patient';
  }

  function doctorName(id) {
    return db.doctors.find(d => d.id === id)?.name
      || 'Unknown Doctor';
  }

  function billForPatient(patientId) {
    const visits = db.visits.filter(
      v => v.patientId === patientId
    );

    const orders = db.orders.filter(
      o => o.patientId === patientId
    );

    const visitTotal = visits.reduce(
      (sum, v) => sum + Number(v.fee || 0),
      0
    );

    const labTotal = orders.reduce(
      (sum, o) => sum + Number(o.total || 0),
      0
    );

    const total = visitTotal + labTotal;

    const paid = db.payments
      .filter(p => p.patientId === patientId)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const due = Math.max(0, total - paid);

    const status = total === 0
      ? 'No charges'
      : paid >= total
        ? 'Paid'
        : paid > 0
          ? 'Partially Paid'
          : 'Unpaid';

    return {
      visitTotal,
      labTotal,
      total,
      paid,
      due,
      status
    };
  }

  // Main application shell
  function renderShell() {
    const todayLabel = document.getElementById('todayLabel');

    if (todayLabel) {
      todayLabel.textContent = today.toLocaleDateString(
        'en-GB',
        {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        }
      );
    }

    const nav = document.getElementById('nav');

    if (nav) {
      nav.innerHTML = navItems.map(([id, icon, label]) => `
        <button
          class="${currentView === id ? 'on' : ''}"
          data-nav="${id}"
        >
          <span class="ic">${icon}</span>${label}
        </button>
      `).join('');
    }

    document.querySelectorAll('[data-nav]').forEach(button => {
      button.onclick = () => {
        currentView = button.dataset.nav;
        renderShell();
      };
    });

    const titles = {
      overview: 'Overview',
      patients: 'Patients',
      visits: 'Doctors & Visits',
      lab: 'Laboratory',
      billing: 'Billing',
      reports: 'Reports',
      assistant: 'AI Assistant',
      settings: 'Settings'
    };

    const subtitles = {
      overview: 'A clear picture of today’s care and hospital operations.',
      patients: 'Manage patient registrations and find records quickly.',
      visits: 'Track consultations, doctors, prescriptions and visit fees.',
      lab: 'Manage laboratory orders and monitor test progress.',
      billing: 'Review patient balances and record payments.',
      reports: 'Explore hospital activity and financial performance.',
      assistant: 'Ask questions about your reports using ChatterMate AI.',
      settings: 'Manage your local workspace and sample records.'
    };

    const pageTitle = document.getElementById('pageTitle');
    const pageSub = document.getElementById('pageSub');

    if (pageTitle) {
      pageTitle.textContent = titles[currentView] || 'Overview';
    }

    if (pageSub) {
      pageSub.textContent = subtitles[currentView] || '';
    }

    const content = document.getElementById('content');

    if (content) {
      content.innerHTML = renderView();
    }

    bindEvents();
  }

  function renderView() {
    switch (currentView) {
      case 'overview':
        return renderDashboard();
      case 'patients':
        return renderPatients();
      case 'visits':
        return renderVisits();
      case 'lab':
        return renderLab();
      case 'billing':
        return renderBilling();
      case 'reports':
        return renderReports();
      case 'assistant':
        return renderAssistant();
      case 'settings':
        return renderSettings();
      default:
        return renderDashboard();
    }
  }

  // Dashboard
  function renderDashboard() {
    const dayISO = iso(today);

    const totalDue = db.patients.reduce(
      (sum, p) => sum + billForPatient(p.id).due,
      0
    );

    const todayCollected = db.payments
      .filter(p => p.date === dayISO)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const todayVisits = db.visits.filter(
      v => v.date === dayISO
    ).length;

    const pendingOrders = db.orders.filter(
      o => o.status !== 'Done'
    );

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));

      const date = iso(d);

      return {
        date,
        label: d.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short'
        }),
        amount: db.payments
          .filter(p => p.date === date)
          .reduce((sum, p) => sum + Number(p.amount || 0), 0)
      };
    });

    const maxAmount = Math.max(
      ...days.map(d => d.amount),
      1
    );

    const recentActivity = [
      ...db.patients.map(p => ({
        date: p.registered,
        title: 'Patient registered',
        detail: p.name
      })),

      ...db.visits.map(v => ({
        date: v.date,
        title: 'Doctor visit recorded',
        detail: `${patientName(v.patientId)} · ${doctorName(v.doctorId)}`
      })),

      ...db.orders.map(o => ({
        date: o.date,
        title: 'Laboratory order created',
        detail: patientName(o.patientId)
      })),

      ...db.payments.map(p => ({
        date: p.date,
        title: 'Payment received',
        detail: `${patientName(p.patientId)} · ${money(p.amount)}`
      }))
    ]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 6);

    return `
      <div class="intro">
        <section class="card welcome">
          <span class="eyebrow">NIVORA CARE / OVERVIEW</span>
          <h2>Better care starts<br>with a clearer view.</h2>
          <p>Monitor patient activity, clinical visits and daily operations in one place.</p>

          <div class="welcome-actions">
            <button class="btn" data-go="patients">+ Register patient</button>
            <button class="btn alt" data-go="visits">Record visit</button>
            <button class="btn alt" data-go="lab">Order a test</button>
          </div>
        </section>

        <section class="card daily-collection">
          <div>
            <span class="eyebrow">TODAY'S COLLECTION</span>
            <div class="amount">${money(todayCollected)}</div>
          </div>
          <small>Payments recorded on ${fmtDate(dayISO)}</small>
        </section>
      </div>

      <div class="metrics">
        <div class="card metric">
          <label>Total patients</label>
          <strong>${db.patients.length}</strong>
          <div class="hint">Registered records</div>
        </div>

        <div class="card metric">
          <label>Today's visits</label>
          <strong>${todayVisits}</strong>
          <div class="hint">Consultations recorded today</div>
        </div>

        <div class="card metric">
          <label>Pending lab orders</label>
          <strong>${pendingOrders.length}</strong>
          <div class="hint">Awaiting completion</div>
        </div>

        <div class="card metric">
          <label>Outstanding balance</label>
          <strong>${money(totalDue)}</strong>
          <div class="hint">Unpaid patient charges</div>
        </div>
      </div>

      <div class="dash-grid">
        <section class="card panel">
          <h3>Collection overview</h3>
          <p class="panel-sub">Payments received over the last seven days</p>

          <div class="chart">
            ${days.map(d => `
              <div class="chart-col" title="${d.label}: ${money(d.amount)}">
                <div class="chart-bar"
                  style="height:${Math.max(4, d.amount / maxAmount * 100)}%">
                  <i>${d.amount ? money(d.amount).replace('Tk ', '') : '0'}</i>
                </div>
                <span style="font-size:10px;color:var(--muted)">${d.label}</span>
              </div>
            `).join('')}
          </div>

          <p class="panel-sub" style="margin-top:14px">
            Total for displayed period:
            <strong>${money(days.reduce((s, d) => s + d.amount, 0))}</strong>
          </p>
        </section>

        <section class="card panel">
          <h3>Recent activity</h3>
          <p class="panel-sub">Latest recorded hospital activity</p>

          ${recentActivity.length ? recentActivity.map(a => `
            <div style="display:flex;gap:12px;padding:11px 0;border-bottom:1px solid var(--line)">
              <div style="width:8px;height:8px;flex-shrink:0;border-radius:50%;background:var(--green);margin-top:7px"></div>
              <div style="min-width:0;flex:1">
                <div style="font-weight:600;font-size:12px">${esc(a.title)}</div>
                <div style="color:var(--muted);font-size:11px;overflow-wrap:anywhere">${esc(a.detail)}</div>
              </div>
              <small style="color:var(--muted);white-space:nowrap">${fmtDate(a.date)}</small>
            </div>
          `).join('') : `
            <p class="panel-sub">No activity yet. Register a patient to get started.</p>
          `}

          <button class="text-button" data-go="reports" style="margin-top:12px">
            View reports →
          </button>
        </section>
      </div>

      <section class="card panel" style="margin-top:16px">
        <h3>Pending laboratory work</h3>
        <p class="panel-sub">Orders that still need attention</p>

        ${pendingOrders.length ? `
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Patient</th>
                  <th>Order date</th>
                  <th>Tests</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${pendingOrders.slice(0, 5).map(o => `
                  <tr>
                    <td>${esc(o.id)}</td>
                    <td>${esc(patientName(o.patientId))}</td>
                    <td>${fmtDate(o.date)}</td>
                    <td>${(o.tests || []).map(t => esc(t.name)).join(', ')}</td>
                    <td><span class="badge amber">${esc(o.status)}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <p class="panel-sub">There are no pending laboratory orders.</p>
        `}

        <button class="text-button" data-go="lab" style="margin-top:12px">
          Open laboratory →
        </button>
      </section>
    `;
  }

  // Patients
  function renderPatients() {
    const list = db.patients.filter(p =>
      [p.name, p.id, p.phone]
        .join(' ')
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    );

    return `
      <div class="layout-two">
        <form class="card form-card" id="patientForm">
          <h3>Register New Patient</h3>

          <div class="form-grid">
            <div class="form-field full">
              <label>Name</label>
              <input name="name" required placeholder="Full Name">
            </div>

            <div class="form-field">
              <label>Age</label>
              <input name="age" type="number" min="0" required placeholder="Age">
            </div>

            <div class="form-field">
              <label>Sex</label>
              <select name="sex">
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
              </select>
            </div>

            <div class="form-field full">
              <label>Phone</label>
              <input name="phone" required placeholder="017XXXXXXXX">
            </div>

            <div class="form-field full">
              <label>Address</label>
              <textarea name="address" required placeholder="Full Address"></textarea>
            </div>
          </div>

          <button class="btn" style="margin-top:12px">Save Patient</button>
        </form>

        <section class="card table-card">
          <div class="table-tools">
            <input id="searchPatients"
              placeholder="Search patients..."
              value="${esc(searchQuery)}"
              style="padding:6px 10px;border:1px solid var(--line);border-radius:6px">

            <strong>${list.length} Records</strong>
          </div>

          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Age/Sex</th>
                  <th>Phone</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(p => `
                  <tr>
                    <td>${esc(p.id)}</td>
                    <td><strong>${esc(p.name)}</strong></td>
                    <td>${esc(p.age)} / ${esc(p.sex)}</td>
                    <td>${esc(p.phone)}</td>
                    <td>${fmtDate(p.registered)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;
  }

  // Doctor visits
  function renderVisits() {
    return `
      <div class="layout-two">
        <form class="card form-card" id="visitForm">
          <h3>Record Doctor Visit</h3>

          <div class="form-grid">
            <div class="form-field full">
              <label>Patient</label>
              <select name="patientId" required>
                ${db.patients.map(p => `
                  <option value="${esc(p.id)}">
                    ${esc(p.name)} (${esc(p.id)})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-field full">
              <label>Doctor</label>
              <select name="doctorId" required>
                ${db.doctors.map(d => `
                  <option value="${esc(d.id)}">
                    ${esc(d.name)} — ${esc(d.specialty)}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-field">
              <label>Date</label>
              <input name="date" type="date" value="${iso(today)}" required>
            </div>

            <div class="form-field">
              <label>Visit Fee (Tk)</label>
              <input name="fee" type="number" min="0" value="800" required>
            </div>

            <div class="form-field full">
              <label>Reason</label>
              <textarea name="reason" required></textarea>
            </div>
          </div>

          <button class="btn" style="margin-top:12px" ${db.patients.length ? '' : 'disabled'}>
            Record Visit
          </button>

          ${db.patients.length ? '' : `
            <p class="panel-sub">Register a patient before recording a visit.</p>
          `}
        </form>

        <section class="card table-card">
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Fee</th>
                </tr>
              </thead>
              <tbody>
                ${db.visits.map(v => `
                  <tr>
                    <td>${esc(v.id)}</td>
                    <td>${fmtDate(v.date)}</td>
                    <td>${esc(patientName(v.patientId))}</td>
                    <td>${esc(doctorName(v.doctorId))}</td>
                    <td>${money(v.fee)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;
  }

  // Laboratory
  function renderLab() {
    return `
      <div class="layout-two">
        <form class="card form-card" id="labForm">
          <h3>Create Lab Order</h3>

          <div class="form-grid">
            <div class="form-field full">
              <label>Patient</label>
              <select name="patientId" required>
                ${db.patients.map(p => `
                  <option value="${esc(p.id)}">${esc(p.name)}</option>
                `).join('')}
              </select>
            </div>

            <div class="form-field full">
              <label>Date</label>
              <input name="date" type="date" value="${iso(today)}" required>
            </div>

            <div class="form-field full">
              <label>Tests</label>
              ${db.catalog.map(t => `
                <label style="display:block;font-size:12px;margin-bottom:4px">
                  <input type="checkbox" name="test" value="${esc(t.id)}">
                  ${esc(t.name)} (${money(t.price)})
                </label>
              `).join('')}
            </div>
          </div>

          <button class="btn" style="margin-top:12px" ${db.patients.length ? '' : 'disabled'}>
            Create Order
          </button>

          ${db.patients.length ? '' : `
            <p class="panel-sub">Register a patient before creating a lab order.</p>
          `}
        </form>

        <section class="card table-card">
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Patient</th>
                  <th>Tests</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${db.orders.map(o => `
                  <tr>
                    <td>${esc(o.id)}</td>
                    <td>${esc(patientName(o.patientId))}</td>
                    <td>${(o.tests || []).map(t => esc(t.name)).join(', ')}</td>
                    <td>${money(o.total)}</td>
                    <td>
                      <span class="badge ${o.status === 'Done' ? 'green' : 'amber'}">
                        ${esc(o.status)}
                      </span>
                    </td>
                    <td>
                      ${o.status === 'Done'
                        ? '—'
                        : `<button class="btn alt" data-complete-order="${esc(o.id)}">Mark done</button>`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;
  }

  // Billing
  function renderBilling() {
    const rows = db.patients
      .map(p => ({ p, b: billForPatient(p.id) }))
      .filter(x => x.b.total > 0);

    const payableRows = rows.filter(x => x.b.due > 0);

    return `
      <div class="layout-two">
        <form class="card form-card" id="paymentForm">
          <h3>Record Payment</h3>

          <div class="form-grid">
            <div class="form-field full">
              <label>Patient</label>
              <select name="patientId" required>
                ${payableRows.map(({ p, b }) => `
                  <option value="${esc(p.id)}">
                    ${esc(p.name)} (Due: ${money(b.due)})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-field">
              <label>Amount (Tk)</label>
              <input name="amount" type="number" required min="1" step="1">
            </div>

            <div class="form-field">
              <label>Method</label>
              <select name="method">
                <option>Cash</option>
                <option>Card</option>
                <option>bKash</option>
              </select>
            </div>

            <div class="form-field full">
              <label>Date</label>
              <input name="date" type="date" value="${iso(today)}" required>
            </div>
          </div>

          <button class="btn" style="margin-top:12px" ${payableRows.length ? '' : 'disabled'}>
            Collect Payment
          </button>

          ${payableRows.length ? '' : `
            <p class="panel-sub">No outstanding balances are available for payment.</p>
          `}
        </form>

        <section class="card table-card">
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Total Billed</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(({ p, b }) => `
                  <tr>
                    <td>${esc(p.name)}</td>
                    <td>${money(b.total)}</td>
                    <td>${money(b.paid)}</td>
                    <td>${money(b.due)}</td>
                    <td>
                      <span class="badge ${
                        b.status === 'Paid'
                          ? 'green'
                          : b.status === 'Unpaid'
                            ? 'red'
                            : 'amber'
                      }">
                        ${esc(b.status)}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;
  }

  // Reports
  function isInReportRange(date) {
    return Boolean(date && date >= reportFrom && date <= reportTo);
  }

  function renderReports() {
    const payments = db.payments.filter(p => isInReportRange(p.date));
    const patients = db.patients.filter(p => isInReportRange(p.registered));
    const visits = db.visits.filter(v => isInReportRange(v.date));
    const orders = db.orders.filter(o => isInReportRange(o.date));

    const collected = payments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );

    const visitFees = visits.reduce(
      (sum, v) => sum + Number(v.fee || 0),
      0
    );

    const labCharges = orders.reduce(
      (sum, o) => sum + Number(o.total || 0),
      0
    );

    const outstanding = db.patients.reduce(
      (sum, p) => sum + billForPatient(p.id).due,
      0
    );

    let reportContent = '';

    if (activeReport === 'collection') {
      reportContent = `
        <div class="metrics report-metrics">
          <div class="card metric">
            <label>Payments collected in range</label>
            <strong>${money(collected)}</strong>
            <div class="hint">${payments.length} payment records</div>
          </div>

          <div class="card metric">
            <label>Visit fees billed</label>
            <strong>${money(visitFees)}</strong>
            <div class="hint">${visits.length} visits in range</div>
          </div>

          <div class="card metric">
            <label>Lab charges billed</label>
            <strong>${money(labCharges)}</strong>
            <div class="hint">${orders.length} lab orders in range</div>
          </div>

          <div class="card metric">
            <label>Current outstanding balance</label>
            <strong>${money(outstanding)}</strong>
            <div class="hint">Current balance across all dates</div>
          </div>
        </div>

        <p class="panel-sub">
          Payment records do not specify whether a payment was allocated to
          visit fees or laboratory tests. Visit fees and lab charges are billed
          amounts, not allocated payment totals.
        </p>

        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Patient</th>
                <th>Payment method</th>
                <th>Amount collected</th>
              </tr>
            </thead>
            <tbody>
              ${payments.length
                ? payments.slice()
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map(p => `
                      <tr>
                        <td>${fmtDate(p.date)}</td>
                        <td>${esc(patientName(p.patientId))}</td>
                        <td>${esc(p.method || '—')}</td>
                        <td>${money(p.amount)}</td>
                      </tr>
                    `).join('')
                : '<tr><td colspan="4">No payments found for this date range.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    } else if (activeReport === 'patients') {
      reportContent = `
        <div class="metrics">
          <div class="card metric">
            <label>New registrations</label>
            <strong>${patients.length}</strong>
            <div class="hint">Within selected dates</div>
          </div>
        </div>

        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Name</th>
                <th>Age</th>
                <th>Sex</th>
                <th>Phone</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              ${patients.length
                ? patients.slice()
                    .sort((a, b) => b.registered.localeCompare(a.registered))
                    .map(p => `
                      <tr>
                        <td>${esc(p.id)}</td>
                        <td>${esc(p.name)}</td>
                        <td>${esc(p.age)}</td>
                        <td>${esc(p.sex)}</td>
                        <td>${esc(p.phone)}</td>
                        <td>${fmtDate(p.registered)}</td>
                      </tr>
                    `).join('')
                : '<tr><td colspan="6">No patient registrations found for this date range.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    } else if (activeReport === 'doctors') {
      const doctorRows = db.doctors.map(doctor => {
        const doctorVisits = visits.filter(
          v => v.doctorId === doctor.id
        );

        return {
          doctor,
          count: doctorVisits.length,
          fees: doctorVisits.reduce(
            (sum, v) => sum + Number(v.fee || 0),
            0
          )
        };
      }).sort((a, b) => b.count - a.count);

      reportContent = `
        <div class="metrics">
          <div class="card metric">
            <label>Total visits in range</label>
            <strong>${visits.length}</strong>
            <div class="hint">Across all doctors</div>
          </div>

          <div class="card metric">
            <label>Visit fees billed</label>
            <strong>${money(visitFees)}</strong>
            <div class="hint">Within selected dates</div>
          </div>
        </div>

        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Specialty</th>
                <th>Visits</th>
                <th>Visit fees billed</th>
              </tr>
            </thead>
            <tbody>
              ${doctorRows.map(r => `
                <tr>
                  <td>${esc(r.doctor.name)}</td>
                  <td>${esc(r.doctor.specialty)}</td>
                  <td>${r.count}</td>
                  <td>${money(r.fees)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      const testCounts = {};

      orders.forEach(o => {
        (o.tests || []).forEach(t => {
          const key = t.name || 'Unknown test';
          testCounts[key] = (testCounts[key] || 0) + 1;
        });
      });

      reportContent = `
        <div class="metrics">
          <div class="card metric">
            <label>Lab orders</label>
            <strong>${orders.length}</strong>
            <div class="hint">Within selected dates</div>
          </div>

          <div class="card metric">
            <label>Lab charges billed</label>
            <strong>${money(labCharges)}</strong>
            <div class="hint">Within selected dates</div>
          </div>

          <div class="card metric">
            <label>Pending orders</label>
            <strong>${orders.filter(o => o.status !== 'Done').length}</strong>
            <div class="hint">In selected date range</div>
          </div>
        </div>

        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Patient</th>
                <th>Tests</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${orders.length
                ? orders.slice()
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map(o => `
                      <tr>
                        <td>${esc(o.id)}</td>
                        <td>${fmtDate(o.date)}</td>
                        <td>${esc(patientName(o.patientId))}</td>
                        <td>${(o.tests || []).map(t => esc(t.name)).join(', ')}</td>
                        <td>${money(o.total)}</td>
                        <td>${esc(o.status)}</td>
                      </tr>
                    `).join('')
                : '<tr><td colspan="6">No lab orders found for this date range.</td></tr>'}
            </tbody>
          </table>
        </div>

        <h3 style="margin-top:20px">Test frequency</h3>

        <div class="scroll">
          <table>
            <thead>
              <tr><th>Test</th><th>Times ordered</th></tr>
            </thead>
            <tbody>
              ${Object.keys(testCounts).length
                ? Object.entries(testCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, count]) => `
                      <tr><td>${esc(name)}</td><td>${count}</td></tr>
                    `).join('')
                : '<tr><td colspan="2">No test data for this date range.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    }

    const tabs = [
      ['collection', 'Collection'],
      ['patients', 'Patient Registrations'],
      ['doctors', 'Doctor-wise'],
      ['laboratory', 'Laboratory']
    ];

    return `
      <section class="card panel report-page">
        <div class="report-header">
          <div>
            <span class="eyebrow">NIVORA CARE / ANALYTICS</span>
            <h3>Hospital Reports</h3>
            <p class="panel-sub">Review activity for a selected date range.</p>
          </div>

          <button class="btn alt" id="printReportBtn" type="button">
            Print report
          </button>
        </div>

        <div class="report-filters">
          <div class="form-field">
            <label for="reportFrom">From</label>
            <input
              type="date"
              id="reportFrom"
              value="${esc(reportFrom)}"
              max="${iso(today)}"
            >
          </div>

          <div class="form-field">
            <label for="reportTo">To</label>
            <input
              type="date"
              id="reportTo"
              value="${esc(reportTo)}"
              max="${iso(today)}"
            >
          </div>

          <button class="btn" id="applyReportDates" type="button">
            Apply dates
          </button>

          <button class="btn alt" id="resetReportDates" type="button">
            This month
          </button>
        </div>

        <div class="report-tabs">
          ${tabs.map(([id, label]) => `
            <button
              class="tab ${activeReport === id ? 'active' : ''}"
              data-report="${id}"
              type="button"
            >
              ${label}
            </button>
          `).join('')}
        </div>

        <div class="report-range">
          <strong>${fmtDate(reportFrom)} – ${fmtDate(reportTo)}</strong>
        </div>

        <div class="report-content">
          ${reportContent}
        </div>
      </section>
    `;
  }

  // AI assistant
  function renderAssistant() {
    return `
      <div class="chat-layout">
        <section class="card chat-card">
          <div class="chat-head">
            <strong>Nivora Report Assistant</strong>
            <small>Powered by ChatterMate</small>
          </div>

          <div class="messages" id="messages">
            <div class="message assistant">
              Hello! I am your AI assistant. Ask me questions about today's collections, patient counts, or doctor visits.
            </div>
          </div>

          <div class="chat-compose">
            <textarea id="chatInput" placeholder="Ask a report question..."></textarea>
            <button class="btn" id="sendChat">Send</button>
          </div>
        </section>

        <aside class="card suggestions" style="padding:16px">
          <strong>Suggested Questions</strong>
          <button data-q="How much did we collect today?">How much did we collect today?</button>
          <button data-q="How many new patients registered this week?">How many new patients registered?</button>
          <button data-q="Which doctor had the most visits?">Which doctor had the most visits?</button>
        </aside>
      </div>
    `;
  }

  // Settings

function renderSettings() {
  return `
    <div class="card panel">
      <h3>System Settings</h3>
      <p>Manage your local workspace and sample records.</p>

      <div style="margin-top:24px; padding:20px; border:1px solid var(--line); border-radius:12px;">
        <h3>AI Report Assistant</h3>
        <p class="panel-sub">
          Enter your own ChatterMate API key to test AI-powered hospital reports.
          Your key is used for this browser session only.
        </p>

        <div class="form-field" style="margin-top:16px;">
          <label for="chatterMateKey">ChatterMate API Key</label>
          <input
            id="chatterMateKey"
            type="password"
            placeholder="Paste your ChatterMate API key"
            autocomplete="off"
            style="width:100%;"
          >
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
          <button class="btn" id="testAiKeyBtn" type="button">
            Test & Use Key
          </button>
          <button class="btn alt" id="clearAiKeyBtn" type="button">
            Clear Key
          </button>
        </div>

        <p id="aiKeyStatus" class="panel-sub" role="status" aria-live="polite" style="margin-top:12px;">
          ${sessionApiKey
            ? 'A key is active for this session.'
            : 'No session key added. The server will use its .env key if configured.'}
        </p>
      </div>

      <div style="margin-top:24px;">
        <button class="btn" id="loadSampleBtn" type="button">
          Load Sample Data
        </button>
        <button class="btn danger" id="clearDataBtn" type="button">
          Reset All Data
        </button>
      </div>
    </div>`;
}


  // Event handlers
  function bindEvents() {
    document.querySelectorAll('[data-go]').forEach(button => {
      button.onclick = () => {
        currentView = button.dataset.go;
        renderShell();
      };
      
const testAiKeyBtn = document.getElementById('testAiKeyBtn');

if (testAiKeyBtn) {
  testAiKeyBtn.onclick = async () => {
    const input = document.getElementById('chatterMateKey');
    const status = document.getElementById('aiKeyStatus');
    const key = input?.value.trim();

    if (!key) {
      if (status) status.textContent = 'Please enter an API key first.';
      return;
    }

    testAiKeyBtn.disabled = true;
    testAiKeyBtn.textContent = 'Testing...';

    try {
      const response = await fetch('/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'API key verification failed.');
      }

      sessionApiKey = key;
      input.value = '';

      if (status) {
        status.textContent =
          'Connected successfully! Your key is active for this session.';
      }

      toast('ChatterMate API key verified');
    } catch (error) {
      if (status) status.textContent = error.message;
    } finally {
      testAiKeyBtn.disabled = false;
      testAiKeyBtn.textContent = 'Test & Use Key';
    }
  };
}

const clearAiKeyBtn = document.getElementById('clearAiKeyBtn');

if (clearAiKeyBtn) {
  clearAiKeyBtn.onclick = () => {
    sessionApiKey = '';

    const input = document.getElementById('chatterMateKey');
    const status = document.getElementById('aiKeyStatus');

    if (input) input.value = '';
    if (status) status.textContent =
      'Session key cleared. The server will use its .env key if configured.';

    toast('Session API key cleared');
  };
}

    });

    // Patient registration
    const patientForm = document.getElementById('patientForm');

    if (patientForm) {
      patientForm.onsubmit = e => {
        e.preventDefault();

        const f = new FormData(patientForm);

        db.patients.unshift({
          id: uid('P'),
          name: String(f.get('name')).trim(),
          age: Number(f.get('age')),
          sex: f.get('sex'),
          phone: String(f.get('phone')).trim(),
          address: String(f.get('address')).trim(),
          registered: iso(today)
        });

        saveDB();
        toast('Patient registered successfully');
        renderShell();
      };
    }

    // Patient search
    const searchInput = document.getElementById('searchPatients');

    if (searchInput) {
      searchInput.oninput = () => {
        const cursor = searchInput.selectionStart;
        searchQuery = searchInput.value;

        const content = document.getElementById('content');

        if (content) {
          content.innerHTML = renderPatients();
        }

        bindEvents();

        const newInput = document.getElementById('searchPatients');

        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(cursor, cursor);
        }
      };
    }

    // Doctor visit recording
    const visitForm = document.getElementById('visitForm');

    if (visitForm) {
      visitForm.onsubmit = e => {
        e.preventDefault();

        const f = new FormData(visitForm);
        const fee = Number(f.get('fee'));
        const patientId = f.get('patientId');
        const date = f.get('date');

        if (!db.patients.some(p => p.id === patientId)) {
          return toast('Please register a patient first.');
        }

        if (!Number.isFinite(fee) || fee < 0) {
          return toast('Enter a valid visit fee.');
        }

        if (!date || date > iso(today)) {
          return toast('Choose a valid visit date.');
        }

        db.visits.unshift({
          id: uid('V'),
          patientId,
          doctorId: f.get('doctorId'),
          date,
          fee,
          reason: String(f.get('reason')).trim()
        });

        saveDB();
        toast('Visit recorded');
        renderShell();
      };
    }

    // Laboratory order creation
    const labForm = document.getElementById('labForm');

    if (labForm) {
      labForm.onsubmit = e => {
        e.preventDefault();

        const f = new FormData(labForm);
        const patientId = f.get('patientId');
        const date = f.get('date');

        const selected = db.catalog.filter(t =>
          f.getAll('test').includes(t.id)
        );

        if (!db.patients.some(p => p.id === patientId)) {
          return toast('Please register a patient first.');
        }

        if (!date || date > iso(today)) {
          return toast('Choose a valid order date.');
        }

        if (!selected.length) {
          return toast('Select at least one test.');
        }

        db.orders.unshift({
          id: uid('L'),
          patientId,
          date,
          tests: selected.map(t => ({ ...t })),
          total: selected.reduce(
            (sum, t) => sum + Number(t.price || 0),
            0
          ),
          status: 'Pending'
        });

        saveDB();
        toast('Lab order created');
        renderShell();
      };
    }

    // Mark laboratory orders complete
    document.querySelectorAll('[data-complete-order]').forEach(button => {
      button.onclick = () => {
        const order = db.orders.find(
          o => o.id === button.dataset.completeOrder
        );

        if (!order) return;

        order.status = 'Done';

        saveDB();
        toast('Lab order marked as done');
        renderShell();
      };
    });

    // Payment recording with balance validation
    const paymentForm = document.getElementById('paymentForm');

    if (paymentForm) {
      paymentForm.onsubmit = e => {
        e.preventDefault();

        const f = new FormData(paymentForm);
        const patientId = f.get('patientId');
        const amount = Number(f.get('amount'));
        const date = f.get('date');

        const bill = billForPatient(patientId);

        if (!db.patients.some(p => p.id === patientId)) {
          return toast('Choose a valid patient.');
        }

        if (!Number.isFinite(amount) || amount <= 0) {
          return toast('Enter a valid payment amount.');
        }

        if (amount > bill.due) {
          return toast('Payment cannot exceed the outstanding balance.');
        }

        if (!date || date > iso(today)) {
          return toast('Choose a valid payment date.');
        }

        db.payments.unshift({
          id: uid('PAY'),
          patientId,
          amount,
          method: f.get('method'),
          date
        });

        saveDB();
        toast('Payment recorded');
        renderShell();
      };
    }

    // AI assistant
    const sendBtn = document.getElementById('sendChat');

    if (sendBtn) {
      sendBtn.onclick = sendAiMessage;
    }

    const chatInput = document.getElementById('chatInput');

    if (chatInput) {
      chatInput.onkeydown = e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendAiMessage();
        }
      };
    }

    document.querySelectorAll('[data-q]').forEach(button => {
      button.onclick = () => {
        const input = document.getElementById('chatInput');

        if (input) {
          input.value = button.dataset.q;
          sendAiMessage();
        }
      };
    });

    // Report tabs
    document.querySelectorAll('[data-report]').forEach(button => {
      button.onclick = () => {
        activeReport = button.dataset.report;
        renderShell();
      };
    });

    // Apply date filters
    const applyDatesBtn = document.getElementById('applyReportDates');

    if (applyDatesBtn) {
      applyDatesBtn.onclick = () => {
        const from = document.getElementById('reportFrom')?.value;
        const to = document.getElementById('reportTo')?.value;

        if (!from || !to || from > to) {
          return toast('Please choose a valid date range.');
        }

        if (to > iso(today)) {
          return toast('The end date cannot be in the future.');
        }

        reportFrom = from;
        reportTo = to;

        renderShell();
      };
    }

    // Reset date filters to this month
    const resetDatesBtn = document.getElementById('resetReportDates');

    if (resetDatesBtn) {
      resetDatesBtn.onclick = () => {
        reportFrom = iso(
          new Date(today.getFullYear(), today.getMonth(), 1)
        );

        reportTo = iso(today);

        renderShell();
      };
    }

    // Print report
    const printReportBtn = document.getElementById('printReportBtn');

    if (printReportBtn) {
      printReportBtn.onclick = () => window.print();
    }

    // Sample data and reset buttons
    const sampleBtn = document.getElementById('sampleBtn');
    if (sampleBtn) sampleBtn.onclick = loadSamples;

    const loadSampleBtn = document.getElementById('loadSampleBtn');
    if (loadSampleBtn) loadSampleBtn.onclick = loadSamples;

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.onclick = resetAll;

    const clearDataBtn = document.getElementById('clearDataBtn');
    if (clearDataBtn) clearDataBtn.onclick = resetAll;
  }

  // AI request
  async function sendAiMessage() {
    const input = document.getElementById('chatInput');

    if (!input) return;

    const q = input.value.trim();
    if (!q) return;

    input.value = '';

    const box = document.getElementById('messages');
    if (!box) return;

    box.innerHTML += `
      <div class="message user">${esc(q)}</div>
      <div class="message assistant" data-loading>Thinking…</div>
    `;

    box.scrollTop = box.scrollHeight;

    try {
      
const res = await fetch('/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: q,
    data: db,
    apiKey: sessionApiKey
  })
});


      const data = await res.json();

      const loading = box.querySelector('[data-loading]');
      if (loading) loading.remove();

      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }

      box.innerHTML += `
        <div class="message assistant">
          ${esc(data.answer || data.error || 'No answer returned.')}
        </div>
      `;
    } catch (_) {
      const loading = box.querySelector('[data-loading]');
      if (loading) loading.remove();

      box.innerHTML += `
        <div class="message assistant">
          Unable to reach the assistant. Check that server.js is running and the API configuration is valid.
        </div>
      `;
    }

    box.scrollTop = box.scrollHeight;
  }

  // Generate fictional sample data
  function loadSamples() {
    db = blankData();

    const dateOffset = daysAgo => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return iso(d);
    };

    // 25 Popular Female Manhwa Characters
    const femaleNames = [
      'Cha Hae-In',         // Solo Leveling
      'Yoo Sangah',         // Omniscient Reader's Viewpoint
      'Han Sooyoung',       // Omniscient Reader's Viewpoint
      'Jung Heewon',        // Omniscient Reader's Viewpoint
      'Lee Jihye',          // Omniscient Reader's Viewpoint
      'Athanasia de Alger', // Who Made Me a Princess
      'Navier Ellie Trovi', // The Remarried Empress
      'Penelope Eckhart',   // Villains Are Destined to Die
      'Roxana Agriche',     // The Way to Protect the Female Lead's Older Brother
      'Tessia Eralith',     // The Beginning After the End
      'Caera Denoir',       // The Beginning After the End
      'Endorsi Jahad',      // Tower of God
      'Yuri Jahad',         // Tower of God
      'Yeon Ehwa',          // Tower of God
      'Shinea',             // Eleceed (Jiyoung Yoo)
      'Jiyoung Yoo',        // Eleceed
      'Carlyn',             // Leveling Up My Husband to the Max
      'Tara Elias',         // I'll Save This Damned Family
      'Florentia Lombardi', // I Shall Master this Family
      'Medea Solon',        // Your Throne
      'Psyche Callista',    // Your Throne
      'Crystal Haggard',    // Lady Crystal Is a Boy
      'Aria Roscente',      // The Villainess Reverses the Hourglass
      'Adele',              // A Stepmother's Marchen
      'Shuri Von Neuschwanstein' // A Stepmother's Marchen
    ];

    // 25 Popular Male Manhwa Characters
    const maleNames = [
      'Sung Jin-Woo',       // Solo Leveling
      'Kim Dokja',          // Omniscient Reader's Viewpoint
      'Yoo Joonghyuk',      // Omniscient Reader's Viewpoint
      'Cale Henituse',      // Trash of the Count's Family
      'Arthur Leywin',      // The Beginning After the End
      'Seo Jiwoo',          // Eleceed
      'Kayden Break',       // Eleceed
      'Park Hyung-Suk',     // Lookism (Daniel Park)
      'Zack Lee',           // Lookism
      'Vasco',              // Lookism
      'Twenty-Fifth Baam',  // Tower of God
      'Khun Aguero Agnes',  // Tower of God
      'Rak Wraithraiser',   // Tower of God
      'Lloyd Frontera',     // The Greatest Estate Developer
      'Javier Asrahan',     // The Greatest Estate Developer
      'Suho Kang',          // Solo Leveling: Ragnarok
      'Chung Myung',        // Return of the Blossoming Blade
      'Jin Mu-Won',         // Legend of the Northern Blade
      'Cheon Yeo-Woon',     // Nano Machine
      'Lucas',              // Who Made Me a Princess
      'Claude de Alger',    // Who Made Me a Princess
      'Callisto Regulus',   // Villains Are Destined to Die
      'Heinrey Alles Blonsboia', // The Remarried Empress
      'Ijekiel Alpheus',    // Who Made Me a Princess
      'Ryu Han-Bin'         // Survival Story of a Sword King
    ];

    // 50 fictional patients
    for (let i = 1; i <= 50; i++) {
      const isFemale = i % 2 === 0;
      const sex = isFemale ? 'Female' : 'Male';
      const namePool = isFemale ? femaleNames : maleNames;
      const nameIndex = Math.floor((i - 1) / 2) % namePool.length;
      const patientName = namePool[nameIndex];

      db.patients.push({
        id: 'P-' + (1000 + i),
        name: patientName,
        age: 18 + ((i * 7) % 63),
        sex: sex,
        phone: '0170000' + String(1000 + i),
        address: 'Fictional address, Bangladesh',
        registered: dateOffset((i * 3) % 30)
      });
    }

    // 45 fictional doctor visits
    for (let i = 0; i < 45; i++) {
      const patient = db.patients[i];

      db.visits.push({
        id: 'V-' + (2001 + i),
        patientId: patient.id,
        doctorId: db.doctors[i % db.doctors.length].id,
        date: dateOffset((i * 2) % 30),
        fee: [600, 800, 1000][i % 3],
        reason: [
          'General consultation',
          'Routine health check',
          'Follow-up consultation',
          'Preventive health visit',
          'Specialist consultation'
        ][i % 5]
      });
    }

    // 30 fictional laboratory orders
    for (let i = 0; i < 30; i++) {
      const patient = db.patients[(i * 2) % db.patients.length];
      const first = db.catalog[i % db.catalog.length];

      const second = i % 3 === 0
        ? db.catalog[(i + 1) % db.catalog.length]
        : null;

      const tests = second ? [first, second] : [first];

      db.orders.push({
        id: 'L-' + (3001 + i),
        patientId: patient.id,
        date: dateOffset((i * 3) % 30),
        tests: tests.map(t => ({ ...t })),
        total: tests.reduce((sum, t) => sum + t.price, 0),
        status: i % 4 === 0 ? 'Done' : 'Pending'
      });
    }

    // Payments for patients with charges
    const patientsWithCharges = db.patients.filter(p =>
      db.visits.some(v => v.patientId === p.id) ||
      db.orders.some(o => o.patientId === p.id)
    );

    patientsWithCharges.forEach((patient, i) => {
      const bill = billForPatient(patient.id);

      if (bill.total <= 0 || i % 5 === 0) return;

      const amount = Math.min(
        bill.total,
        Math.round(
          (bill.total * (i % 3 === 0 ? 1 : 0.5)) / 50
        ) * 50
      );

      if (amount <= 0) return;

      db.payments.push({
        id: 'PAY-' + (4001 + i),
        patientId: patient.id,
        amount,
        method: ['Cash', 'Card', 'bKash'][i % 3],
        date: dateOffset((i * 2) % 30)
      });
    });

    saveDB();
    toast('50 patients and sample activity loaded');
    renderShell();
  }

  // Reset all data
  function resetAll() {
    if (!confirm('Are you sure you want to clear all data?')) {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    db = blankData();
    searchQuery = '';

    toast('Data reset');
    renderShell();
  }

  // Start application
  renderShell();
})();
