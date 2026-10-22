# Nivora Care — Hospital Management System with AI Assistant

Nivora Care is a healthcare management web application built with vanilla JavaScript, HTML5, CSS3, and Node.js built-in modules. It features an AI Report Assistant powered by ChatterMate.

<p align="center">
  <img src="Screenshot 2026-10-22 145911.png" alt="Nivora Care Overview" width="700">
</p>

## Features
- **Dashboard**: Financial overview, metrics, and collection tracking.
- **Patient Management**: Registration, auto ID generation, search, and local storage persistence.
- **Doctor Visits & Prescriptions**: Record visits, manage doctor fees, and auto-link to billing.
- **Laboratory Management**: Price catalog, multi-test ordering, status tracking (Pending/Done).
- **Billing & Payments**: Integrated financial calculation, payments via Cash, Card, or bKash.
- **Reports**: Daily Collection, Registration, Doctor-wise, and Lab reports with printable views.
- **AI Report Assistant**: Natural language querying powered by the ChatterMate API stream.

## Setup Instructions (Windows)

1. **Install Node.js**: Ensure Node.js (LTS version) is installed from [nodejs.org](https://nodejs.org).
2. **Setup Folder**: Place all 6 project files (`index.html`, `style.css`, `app.js`, `server.js`, `.env.example`, `README.md`) in one folder.
3. **Create `.env` file**:
   - Copy `.env.example` to `.env`.
   - Add your ChatterMate key:
     `CHATTERMATE_API_KEY=cm_live_your_actual_key_here`
4. **Run the Application**:
   Open Command Prompt or Terminal in your project folder and run:
   ```bash
   node --env-file=.env server.js

**Author**
- **Sumaiya Salekin Saba**
