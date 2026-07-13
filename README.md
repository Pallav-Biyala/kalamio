# Blog App (Work in Progress)

A full‑stack blog application currently under active development.

---

## 🚧 Project Status

**In Progress**
Core authentication, user profiles, blog fetching, routing, and UI animations are implemented.
Advanced blog features and polishing are in progress.

---

## 🚀 Getting Started (Local Setup)

> **Heads-up:** `.env` files are git-ignored, so a fresh clone will **not** include them.
> You must create them from the provided examples or every API call 404s against the
> dev server (you'll see requests to `undefinedapi/v1/...` in the console).

```bash
# 1. Install dependencies
cd frontend && npm install
cd ../server && npm install

# 2. Create env files from the examples (required)
cp frontend/.env.example frontend/.env      # sets VITE_SERVER_DOMAIN
cp server/.env.example   server/.env        # DB URL, JWT secret, AWS, etc.

# 3. Run (two terminals)
cd server   && npm run dev                  # API on :8080
cd frontend && npm run dev                  # app on :5173
```

The frontend expects `VITE_SERVER_DOMAIN` to point at the running backend (default
`http://localhost:8080/`, **trailing slash required**). Restart `npm run dev` after
changing any `.env` — Vite only reads env vars at startup.

---

## 🛠️ Technologies Used

### Frontend

* **React.js** – UI development
* **React Router** – Routing and protected pages
* **Context API** – Global authentication state
* * **Axios** – API communication
* **Page Animations** – Smooth route transitions

### Backend

* **Node.js** – Server runtime
* **Express.js** – REST API framework
* **MongoDB** – Database
* **Mongoose** – ODM for MongoDB
* * **MVC-style structure** – Controllers, routes, models

### Authentication

* **JWT (JSON Web Tokens)** – Secure authentication
* **Firebase Google OAuth** – Google sign‑in
* **bcrypt** – Password hashing

### Cloud & Storage

* **AWS S3** – Blog banner image storage
* **Signed URLs** – Secure image uploads

### Utilities & Tools

* **dotenv** – Environment variable management
* **nanoid** – Unique ID generation
* **Git & GitHub** – Version control

---

## ✅ Features Implemented So Far

* User authentication (Email + Google OAuth)
* JWT‑based authorization
* Protected routes
* Blog editor page
* Publish flow setup
* AWS S3 image upload using signed URLs
* Secure environment variable handling
* Pagination
* * User signup & login
* User profile page
* About user section
* User routes
* Blog page route
* Get-blog API
* Blog rendering
* Page-to-page animations
* Loader component
* Responsive navbar
* 404 (Not Found) page


---

## 📌 What I’m Currently Working On

* * Blog creation & editor improvements
* Blog publish workflow
* Backend validations & error handling
* Performance & UI polish


---

## 🔮 Planned Features

* Draft saving
* Likes and comments
* Search & filtering
* Follow system
* Deployment

## 🎯 Learning Objectives

* Building a real-world MERN stack application
* Implementing authentication & authorization
* Structuring scalable backend APIs
* Managing global state in React
* Handling media uploads securely


---

> This README will evolve as the project progresses. A detailed architecture‑level README will be added once core features are finalized.
