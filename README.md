# Hankers — Backend API

<div align="center">
  <img src="public/favicon.svg" alt="Hankers Logo" width="120" height="120" />
  <h2>Scalable Social Networking Backend — NestJS</h2>
  <p>A modular, production-ready REST API powering the Hankers platform</p>
  <a href="https://hankers.tech" target="_blank"><strong>🔗 Live Platform: hankers.tech</strong></a>
</div>

---

## 📌 Overview

**Hankers Backend** is a **scalable, secure, and maintainable REST API** built with **NestJS** and **TypeScript**, designed to support a modern social networking platform similar to Twitter/X.

The backend follows **domain-driven and feature-based architecture**, emphasizing:

- Clear separation of concerns
- Strong typing and validation
- Testability and scalability
- Real-world backend engineering practices

This codebase is structured to support **large teams**, **high traffic**, and **long-term growth**.

---

## ✨ Core Backend Features

* 🔐 **Authentication & Authorization**

  - JWT access & refresh tokens
  - OTP & password reset flows
  - Role-based access control (RBAC)
* 👤 **User Management**

  - Profiles, avatars, bios
  - Follow / unfollow system
  - Privacy & account settings
* 📝 **Posts & Interactions**

  - Create, edit, delete posts
  - Replies, likes, reposts
  - Optimized feed queries
* 💬 **Messaging System**

  - One-to-one & group chats
  - Read receipts & typing indicators
  - WebSocket real-time support
* 🔔 **Notifications**

  - Real-time notifications
  - Event-driven architecture
  - Firebase / push-ready
* 🔍 **Search & Explore**

  - Hashtags & trending topics
  - User & content search
  - Pagination & filtering
* 🛡 **Security**

  - Input validation
  - Rate limiting
  - Secure password hashing

---

## 🧱 Architecture Philosophy

The backend follows a **Feature-First Modular Architecture**, fully aligned with NestJS best practices.

Each feature is:

- Encapsulated inside its own module
- Independently testable
- Easy to scale, refactor, or remove

> ✅ This avoids bloated global folders and mirrors real production NestJS systems.

---

## 🛠 Tech Stack

### Core

- **Framework**: NestJS
- **Language**: TypeScript
- **Runtime**: Node.js

### Data & Infrastructure

- **Database**: PostgreSQL
- **ORM**: Prisma
- **Caching**: Redis
- **File Storage**: AWS S3 (or compatible)

### Communication

- **API**: REST
- **Real-Time**: WebSockets (Socket.IO)
- **Async Events**: Event Emitters / Queues

### Security & Auth

- **Auth**: JWT + Passport
- **Validation**: class-validator & class-transformer
- **Hashing**: bcrypt

### Testing & Quality

- **Unit & Integration**: Jest
- **E2E Testing**: Supertest
- **Linting**: ESLint + Prettier

### DevOps & Deployment

- **Containerization**: Docker
- **CI/CD**: GitHub Actions
- **Hosting**: AWS

---

## 🚀 Getting Started

### 1️⃣ Install Dependencies

```bash
npm install
```

---

### ⚙️ Backend Team
<table>
<tr>
  <td align="center">
    <a href="https://github.com/OmarNabil005">
      <img src="https://github.com/OmarNabil005.png" width="100">
      <br />
      <sub><b>Omar Nabil</b></sub>
    </a>
  </td>
  <td align="center">
    <a href="https://github.com/Salah3060">
      <img src="https://github.com/Salah3060.png" width="100">
      <br />
      <sub><b>Salah Mostafa</b></sub>
    </a>
  </td>
  <td align="center">
    <a href="https://github.com/ahmedGamalEllabban">
      <img src="https://github.com/ahmedGamalEllabban.png" width="100">
      <br />
      <sub><b>Ahmed Ellabban</b></sub>
    </a>
  </td>
  <td align="center">
    <a href="https://github.com/mohamed-sameh-albaz">
      <img src="https://github.com/mohamed-sameh-albaz.png" width="100">
      <br />
      <sub><b>Mohamed Albaz</b></sub>
    </a>
  </td>
  <td align="center">
    <a href="https://github.com/YousefAref72">
      <img src="https://github.com/YousefAref72.png" width="100">
      <br />
      <sub><b>Yousef Aref</b></sub>
    </a>
  </td>
</tr>
</table>
