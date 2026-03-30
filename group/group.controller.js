// group/group.controller.js

const getAllGroups = async (req, res) => {
    try {
        const sequelize = require('../config/database');   // adjust path if needed
        const DeviceFactory = require('../device/device.model');
        const Device = DeviceFactory(sequelize, require('sequelize').DataTypes);

        const groups = await Device.findAll({
            attributes: [
                [sequelize.fn('DISTINCT', sequelize.col('group')), 'group']
            ],
            where: {
                group: {
                    [require('sequelize').Op.not]: null
                }
            },
            order: [['group', 'ASC']]
        });

        const groupList = groups
            .map(item => item.get('group'))
            .filter(group => group && group.trim() !== '');

        return res.json({
            success: true,
            total: groupList.length,
            groups: groupList
        });

    } catch (err) {
        console.error("Error in getAllGroups:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching groups",
            error: err.message
        });
    }
};

module.exports = {
    getAllGroups
};