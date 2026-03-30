const express = require('express');
const router = express.Router();
const deviceController = require('./device.controller');

router.post('/devices/register', deviceController.registerDevice);

router.post('/devices/status', deviceController.updateStatus);

router.get('/devices', deviceController.listDevices);   

router.get('/my-devices', deviceController.listMyDevices);

router.post('/generate-code', deviceController.generateCode);

router.post('/command/:deviceId', deviceController.sendCommand);

router.get('/search', deviceController.searchDevices);

router.put('/device/:deviceId', deviceController.updateDevice);

router.patch('/:deviceId/toggle', deviceController.toggleDisableDevice);

router.delete('/delete/:deviceId', deviceController.deleteDevice);

router.post('/reboot-agent/:deviceId', deviceController.rebootAgent);

router.post('/reboot-os/:deviceId', deviceController.rebootOS);

module.exports = router;
