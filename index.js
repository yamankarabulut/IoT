const express = require("express");
require("dotenv").config();
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const { createToken } = require("./jwt.util");
const authenticateJWT = require("./middlewares/check.jwt");
const checkJWT = require("./middlewares/check.jwt.with.roles");
const checkApiKey = require("./middlewares/check.api.key.js");
const logViewMiddleware = require("./middlewares/log.view.middlware");
const User = require("./models/user");
const ViewLog = require("./models/viewLog.js");
const ErrorLog = require("./models/error.log.js");
const MqttData = require("./models/mqtt.data.js");
const rateLimiter = require("./middlewares/rate.limiter");
const ERoles = require("./enums/ERoles.js");
const EResultCodes = require("./enums/EResultCodes.js");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// db connection
mongoose
  .connect("mongodb://localhost:27017/er-meydani", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Mongo connected"))
  .catch((err) => console.error("Mongo connection error:", err));

app.use(express.json());
app.use(rateLimiter);
app.set("view engine", "twig");

app.get(
  "/",
  checkJWT.checkEligibility(ERoles.SYSTEM_ADMIN),
  async (req, res) => {
    try {
      return res.status(EResultCodes.OK).send("Hello World!");
    } catch (error) {
      return res
        .status(EResultCodes.INTERNAL_SERVER_ERROR)
        .send("Error on main test page: " + error.message);
    }
  }
);

app.get(
  "/user/view-logs",
  checkJWT.checkEligibility(ERoles.USER),
  logViewMiddleware,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        ViewLog.find({}).sort({ timeStamp: -1 }).skip(skip).limit(limit),
        ViewLog.countDocuments(),
      ]);
      return res.status(EResultCodes.OK).json({
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalLogs: total,
        logs,
      });
    } catch (error) {
      return res
        .status(EResultCodes.INTERNAL_SERVER_ERROR)
        .send("Error while fetching logs: " + error.message);
    }
  }
);

app.get("/view-logs-json", checkJWT.checkEligibility(ERoles.SYSTEM_ADMIN), logViewMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      MqttData.find({}, '-_id -__v').sort({ createdAt: -1 }).skip(skip).limit(limit),
      MqttData.countDocuments(),
    ]);

    return res.json({
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalLogs: total,
      logs,
    });
  } catch (error) {
    return res.status(EResultCodes.INTERNAL_SERVER_ERROR).send("Error while fetching logs: " + error.message);
  }
});

app.get("/view-logs", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      MqttData.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
      MqttData.countDocuments(),
    ]);

    return res.render("view-data", {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalLogs: total,
      logs,
    });
  } catch (error) {
    return res.status(500).send("Error while fetching logs: " + error.message);
  }
});

// GUI to imitate the data sending part from IoT devices
app.get("/data-sender", async (req, res) => {
  try {
    res.sendFile(path.join(__dirname, "public", "dataSenderClient.html"));
  } catch (error) {
    console.error("data-screen error:", error.message);
    res
      .status(EResultCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Internal server error." });
  }
});

// to monitor the data from the IoT devices
app.get("/screen-data/:privateKey", async (req, res) => {
  try {
    const user = await User.findOne({ private_key: req.params.privateKey });
    if(!user) return res.status(EResultCodes.BAD_REQUEST).send("not-found");
    return res.render("screen-data", { guid: user.private_key });
  } catch (error) {
    console.error("screen-data error:", error.message);
    res.status(EResultCodes.INTERNAL_SERVER_ERROR).json({ message: "Internal server error." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    if (!req.body.user_id)
      return res.status(400).json({ message: "user_id is required" });
    if (req.body.role == undefined || req.body.role == null)
      return res.status(400).json({ message: "role is required" });
    let user = await User.findOneAndUpdate(
      { user_id: req.body.user_id },
      { role: req.body.role },
      { new: true }
    );
    if (!user) {
      user = await User.create({
        user_id: req.body.user_id,
        role: req.body.role,
        private_key: uuidv4(),
      });
    }
    const token = createToken({ user_id: user.user_id, role: user.role });
    return res.status(EResultCodes.CREATED).json({ token });
  } catch (error) {
    console.error("Error during login:", error.message);
    return res
      .status(EResultCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Internal server error." });
  }
});

app.get("/api-key-test", checkApiKey, async (req, res) => {
  return res.send("correct-api-key");
});

// could use redis instead
global.connections = new Map();

io.on("connection", async (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("login", async function (data) {
    console.log("Login received from socket:", data);
    connections.set(socket.id, { socket: socket, data: data, type: data.type });
    console.log("CL : ", connections.size);
  });

  socket.on("incoming_data", async (data) => {
    console.log("incoming_data event, data:", data);
    let mqttData = {
      sensor_id: data.sensor_id,
      temperature: data.temperature,
      humidity: data.humidity,
      timestamp: data.timestamp,
      private_key: data.private_key,
    };
    try {
      mqttData = await MqttData.create(mqttData);
    } catch (error) {
      await ErrorLog.create({
        errorType: "error-while-creating-mqtt-data",
        data: mqttData,
      });
    }
    
    const user = await User.findOne({ private_key: data.private_key });
    if (!user) return socket.emit("error", "User not found");
    // if there user is online, send it to their socket for monitoring
    for (const [id, conn] of connections.entries()) {
      if (conn.type == "data-screen" && conn.data.private_key == user.private_key) {
        conn.socket.emit("notification", mqttData);
        console.log("found user");
      }
    }
    console.log("CL: ", connections.size);
    //console.log(mqttData);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    connections.delete(socket.id);
    console.log("CL: ", connections.size);
  });
});

server.listen(process.env.PORT, () => {
  console.log(`Server running at http://localhost:${process.env.PORT}`);
});
