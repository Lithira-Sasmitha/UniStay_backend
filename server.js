require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const helmet = require("helmet");

const connectDB = require("./config/db");

// Routes
const userRoutes = require("./routes/userRoutes");
const safetyRoutes = require("./routes/safetyroutes/a");

// Error Middleware
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

// Initialize app
const app = express();

// Connect Database
connectDB();

// Middleware
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(helmet());

// ------------------ ROUTES ------------------

app.use("/api/users", userRoutes);
app.use("/api/incidents", safetyRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.send("UniStay API is Running...");
});

// ------------------ ERROR HANDLING ------------------

app.use(notFound);
app.use(errorHandler);

// ------------------ SERVER ------------------

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});