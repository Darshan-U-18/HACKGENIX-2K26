# ResilSync Engine

Offline-first disaster-response data synchronization system MVP.

## Technology Stack

**Frontend:**
- React (Vite)
- JavaScript
- IndexedDB (Pending)
- React Router

**Backend:**
- Node.js
- Express
- MongoDB Atlas (Mongoose)

## Installation & Running

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure Environment Variables:
   - Create a `.env` file in the `backend` folder (or edit the existing one).
   - Set the following variables:
     ```env
     MONGO_URI=your_mongodb_atlas_connection_string
     PORT=5000
     ```
4. Start the backend server:
   ```bash
   node src/server.js
   ```

## Expected Health Endpoint Response

```json
{
  "success": true,
  "message": "ResilSync API is running"
}
```

## MongoDB Atlas Setup

To connect the application to a cloud database for the hackathon demonstration:

1. Create a MongoDB Atlas cluster.
2. Create a database user (username and password).
3. Configure network access (e.g., allow IP `0.0.0.0/0` for demo purposes).
4. Copy your Atlas connection string (Driver: Node.js).
5. Open the `backend/.env` file and set the `MONGO_URI` variable to your connection string. Make sure to specify the database name as `resilsync` in the URL (e.g., `mongodb+srv://<username>:<password>@cluster.../resilsync?...`).
6. Start the backend (`npm run dev`).
7. Verify the MongoDB connection in the backend console output (it should say `MongoDB Connected: <cluster-host>`).
