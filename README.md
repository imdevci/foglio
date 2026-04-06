# Foglio 📝

**Foglio** is a modern, minimal, and open-source Markdown editor designed to make writing fluid and distraction-free. Built with **React**, **Vite**, **Docker**, **MongoDB**, **NestJS**, **JWT Authentication** and **MinIO Object Storage**, it offers an intuitive interface for those who want the power of Markdown with the convenience of an immediate, glassmorphic toolbar.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E02347?style=flat&logo=nestjs&logoColor=white)    
![JWT](https://img.shields.io/badge/JWT-black?style=flat&logo=json-web-tokens)

---

## ✨ Features

- **Pure Minimalism:** A clean writing area focused entirely on your content.
- **Secure Authentication:** Custom JWT-based login and registration system with Refresh Token support.
- **MinIO Storage & File Manager:** Images, PDFs and audio notes are stored in MinIO object storage with a dedicated Docker web file manager console (`http://localhost:9001`).
- **Embedded PDF Viewer:** Seamlessly embed and preview PDFs directly inside your notes via native iframe viewer with download/external open options.
- **Audio Embeddings:** Seamlessly embed and play audio files directly inside your notes with play/pause toggle and volume control.
- **Intuitive Toolbar:** Quick support for standard formatting (Bold, Italic, Headers, Images, PDFs, Audio).
- **Advanced Elements:** Easy management of tables, checklists, code blocks, and links.
- **Native Dark Mode:** An elegant dark design to reduce eye strain during long writing sessions.
- **High Performance:** Lightning-fast experience powered by the Vite build tool.

## 🚀 Getting Started

To run the project locally, follow these steps:

### 1. Clone the repository
```bash
git clone https://github.com/imdevci/foglio.git
```

### 2. Configure Environment Variables

1. Copy `.env-example` to `.env`:
   ```bash
   cp .env-example .env
   ```
2. Open `.env` and set your secrets:
   - `JWT_ACCESS_SECRET`: A strong secret for Access Tokens.
   - `JWT_REFRESH_SECRET`: A strong secret for Refresh Tokens.
   - `MONGODB_URI`: Your MongoDB connection string (defaults to local Docker instance).
   - `MINIO_ROOT_USER` & `MINIO_ROOT_PASSWORD`: Credentials for MinIO console/API (default: `minioadmin`).

### 3. Run the application

```bash
docker compose up -d --build
```

- **Foglio Web App:** `http://localhost:80`
- **MinIO File Manager Console:** `http://localhost:9001` (login with your MinIO credentials)

## 🛠️ Tech Stack

* [React](https://reactjs.org/) - UI Library
* [Vite](https://vitejs.dev/) - Next Generation Frontend Tooling
* [Markdown](https://daringfireball.net/projects/markdown/) - Lightweight markup language
* [NestJS](https://nestjs.com/) - Backend framework
* [MongoDB](https://www.mongodb.com/) - NoSQL database
* [MinIO](https://min.io/) - S3-compatible Object Storage & File Manager
* [JWT](https://jwt.io/) - JSON Web Tokens for authentication
* [Docker](https://www.docker.com/) - Containerization

## 🤝 Contributing

Contributions are welcome! If you have ideas for new features or find any bugs, feel free to open an issue or submit a pull request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the **MIT License**. See the `LICENSE` file for more details.

---

Created with ❤️ by **@imdevci**
