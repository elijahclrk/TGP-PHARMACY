# 💊 TGP Pharmacy Inventory and Sales Management System

## System Analysis and Design Project

A web-based **Pharmacy Inventory and Sales Management System** developed for **The Generics Pharmacy (TGP)**.

The system is designed to streamline pharmacy operations by managing medicine inventory, monitoring stock levels and expiration dates, processing cash sales, tracking purchases, and generating business reports through a centralized platform.

---

## 📌 Project Overview

The **TGP Pharmacy Inventory and Sales Management System** is developed as an academic project under the **System Analysis and Design** subject.

It aims to improve the accuracy, efficiency, and organization of pharmacy inventory and sales operations by reducing manual recordkeeping and providing role-based access to essential management features.

The application supports **Administrator, Manager, and Employee** accounts.

---

## 🎯 Project Objectives

- Centralize medicine and inventory records.
- Monitor stock availability and expiration dates.
- Reduce manual inventory and sales recording errors.
- Process and track cash-based point-of-sale transactions.
- Apply First-Expired, First-Out (FEFO) inventory allocation.
- Manage suppliers, purchase orders, and stock receiving.
- Support controlled returns, product exchanges, and inventory adjustments.
- Generate sales, inventory, and management reports.
- Maintain user accountability through role-based access and audit logs.

---

## ⚙️ Main Features

### 💊 Product and Inventory Management

- Add, view, and update medicine products.
- Manage medicine batches, costs, and selling prices.
- Monitor inventory quantities and expiration dates.
- Track low-stock and expiring medicines.
- Configure reorder thresholds.
- Apply FEFO principles to inventory deductions.

### 🛒 Point of Sale (POS)

- Search and select medicines.
- Manage a shopping cart.
- Process cash payments.
- Calculate transaction totals and change.
- Generate internal transaction receipts.
- Search and review transaction history.
- Support locally tested Senior Citizen and PWD discount workflows, subject to applicable validation and deployment controls.

### 📦 Supplier and Purchase Order Management

- Maintain supplier records.
- Create and manage purchase orders.
- Record approved stock receiving.
- Track partial and complete purchase order receiving.
- Update inventory through controlled stock-in transactions.

### 🔄 Returns and Product Exchanges

- Record product-return requests.
- Manage return reviews and approvals.
- Track quarantined returned medicines.
- Process supported equal-value and higher-value product exchanges.
- Maintain exchange transaction history and audit records.
- Restrict unresolved clinical, statutory, or settlement scenarios.

### ✅ Approvals and Inventory Adjustments

- Request inventory adjustments.
- Review and approve authorized inventory changes.
- Manage controlled approval workflows.
- Maintain traceability of stock movements.

### 📊 Dashboard and Reports

- View inventory and sales summaries.
- Monitor stock conditions and business activity.
- Generate sales and inventory reports.
- Export supported reports to Excel and PDF.
- Provide management-level visibility into transactions and operational records.

### 👥 User and Access Management

- Administrator, Manager, and Employee roles.
- Secure login and session management.
- Role-based permissions.
- Administrative account management.
- User activity and audit logs.
- Persistent supported notification preferences.

---

## 🔑 Demo Login Accounts

The following accounts are available for authorized academic demonstration and system evaluation.

| Username | Role | Password |
|---|---|---|
| demo_employee | Employee | af2a40dfc87fc9068a4854f3dca2da4c592d5a7657ace130 |
| demo_manager | Manager | 73d51d66fa2fa84fd52210983c3ace97d1c742fe61c40299 |
| demo_admin | Administrator | e4eb9af1c806914a335fe85f692d51ba2d8dc4c7e0f5f7d3 |
| demo_pharmacist | Pharmacist | 2ef534673281df5e8faf1c50029910ee8b8e84a27d0745f6 |
| demo_verifier | Verifier | 6edd9bbeb0e7501d18e632b7171eb5e5cca5c347385650b3 |

---

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL (Neon) |
| API | REST API |
| Version Control | Git and GitHub |
| CI | GitHub Actions |
| Deployment | Cloud hosting (deployment in progress) |

---

## 🏗️ System Architecture

The application follows a centralized web-based architecture:

**Web Browser → React Frontend → Express REST API → PostgreSQL Database**

Authorized users access the system through a web browser. Business rules and security controls are enforced by the backend, while persistent pharmacy records are stored in PostgreSQL.

---

## 🧪 Testing and Validation

The academic MVP has undergone local functional and automated validation, including:

- 130 frontend tests passed.
- 237 backend reported test entries passed.
- 43 Chrome browser journey groups passed.
- PostgreSQL integration and concurrency testing.
- Lint and Node.js 24 production build verification.

These results describe local validation and do not constitute commercial deployment certification or actual pharmacy acceptance.

---

## 📁 Project Documentation

The project includes System Analysis and Design documentation covering:

- Requirements gathering and analysis.
- Feasibility study.
- Use case and activity diagrams.
- Data flow diagrams.
- Entity relationship diagram.
- Database schema and migration design.
- User interface designs and wireframes.
- System architecture.
- Implementation and testing reports.
- Acceptance and deployment readiness documentation.

---

## 🎓 Academic Project

**Subject:** System Analysis and Design  
**Project:** TGP Pharmacy Inventory and Sales Management System  
**Purpose:** Academic and Educational Project  
**Application Type:** Web-Based Inventory and Sales Management System

---

## 👨‍💻 Project Team

| Name | Role |
|---|---|
| Refuncion | Administrator / Project Leader / Full-Stack Integration |
| Diaz, I. | Employee / Frontend Developer |
| De Guzman | Manager / Backend Developer |
| Cuajao | Verifier / Database Developer |
| De Vera | Pharmacist / QA Tester / Documentation |

*Replace the placeholders with the actual project members and roles.*

---

## 🔐 Security and Usage Notes

- Environment credentials and database connection strings must never be committed to GitHub.
- Access to pharmacy functions is controlled by user roles.
- Experimental transactions must use isolated synthetic data.
- Production use of statutory discounts, fiscal invoicing, and restricted medicine workflows requires appropriate validation and authorization.
- The application is intended for academic demonstration while commercial production readiness requirements remain outstanding.

---

## 📄 Project Status

**Academic MVP:** Implemented and locally tested  
**Cloud Deployment:** In preparation  
**Commercial Production:** Pending operational and required external approvals

---

*Developed as part of the System Analysis and Design academic project.*
