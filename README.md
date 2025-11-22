# telegram-mining-dapp

Repositorio inicializado automáticamente.

Estructura:
- backend/ (Python Flask)
- frontend/ (Vite + React)

Cómo usar (local):

1. Backend:
   - Crea un virtualenv e instala dependencias:
     ```pwsh
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     pip install -r backend/requirements.txt
     ```
   - Ejecuta el backend (ajusta según el `main.py` del proyecto):
     ```pwsh
     python backend\src\main.py
     ```

2. Frontend:
   - Desde `frontend/`, instala dependencias y ejecuta el servidor de desarrollo:
     ```pwsh
     pnpm install
     pnpm dev
     ```

Notas:
- He configurado un `.gitignore` genérico para Python/Node/VSCode.
- He realizado un commit inicial localmente. Para subir a un remoto, añade el origin y haz push:
  ```pwsh
  git remote add origin <URL>
  git push -u origin main
  ```

Ajusta `git config user.name` y `user.email` en este repositorio local si deseas que los commits se atribuyan a otro autor.
