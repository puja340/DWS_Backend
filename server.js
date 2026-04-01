const express = require('express');
const sequelize = require('./config/database');
const signupRoutes = require('./signup/signup.routes');
const loginRoutes = require('./login/login.routes');
const forgotRoutes = require('./forgot-password/forgot.routes');
const deviceRoutes = require('./device/device.routes');
const { setupWebSocket } = require('./Websocket');
const updateRoutes = require('./updateProfile/update.routes');
const groupRoutes = require('./group/group.routes');
const emailRoutes = require('./verify-email/email.routes');


require('dotenv').config();
require('./device/device.model')(sequelize, require('sequelize').DataTypes);
require('./verify-email/email.model')(sequelize, require('sequelize').DataTypes);

const app = express();
app.use(express.json());

// Routes
app.use('/api/auth', signupRoutes);
app.use('/api/auth', loginRoutes);
app.use('/api/auth', forgotRoutes);
app.use('/api/device', deviceRoutes);   
app.use('/api/group', groupRoutes);   
app.use('/api/update', updateRoutes);
app.use('/api/email', emailRoutes);   

sequelize.sync({ alter: true })
  .then(() => console.log('Postgres connected & models synced'))
  .catch(err => console.error(err));

  

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});


setupWebSocket(server);
