const sequelize = require('../config/database');
const GroupFactory = require('./group.model');
const Group = GroupFactory(sequelize, require('sequelize').DataTypes);

const getAllGroups = async (req, res) => {
  try {
    const groups = await Group.findAll({
      attributes: ['id', 'name', 'description'],
      order: [['name', 'ASC']]
    });

    return res.json({
      success: true,
      total: groups.length,
      groups: groups   
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

const createGroup = async (req, res) => {
    try {
      const { name, description } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: "Group name is required"
        });
      }

      // Check if group already exists
      const existingGroup = await Group.findOne({ 
        where: { name: name.trim() } 
      });

      if (existingGroup) {
        return res.status(409).json({
          success: false,
          message: "Group with this name already exists"
        });
      }

      const newGroup = await Group.create({
        name: name.trim(),
        description: description ? description.trim() : null
      });

      return res.status(201).json({
        success: true,
        message: "Group created successfully",
        data: newGroup
      });

    } catch (err) {
      console.error("Error in createGroup:", err);
      return res.status(500).json({
        success: false,
        message: "Server error while creating group",
        error: err.message
      });
    }
};

const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Group ID is required"
      });
    }

    // Check if group exists
    const group = await Group.findByPk(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    await group.destroy();

    return res.json({
      success: true,
      message: `Group "${group.name}" deleted successfully`
    });

  } catch (err) {
    console.error("Error in deleteGroup:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting group",
      error: err.message
    });
  }
};

// ====================== NEW: UPDATE / EDIT GROUP ====================
const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Group ID is required"
      });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Group name is required"
      });
    }

    const trimmedName = name.trim();

    // Find the group
    const group = await Group.findByPk(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    // Check if new name already exists (excluding current group)
    const existingGroup = await Group.findOne({
      where: { 
        name: trimmedName,
        id: { [require('sequelize').Op.ne]: id }   // not equal to current id
      }
    });

    if (existingGroup) {
      return res.status(409).json({
        success: false,
        message: "Another group with this name already exists"
      });
    }

    // Update the group
    await group.update({
      name: trimmedName,
      description: description ? description.trim() : null
    });

    // Fetch updated group to return
    const updatedGroup = await Group.findByPk(id, {
      attributes: ['id', 'name', 'description']
    });

    return res.json({
      success: true,
      message: "Group updated successfully",
      data: updatedGroup
    });

  } catch (err) {
    console.error("Error in updateGroup:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while updating group",
      error: err.message
    });
  }
};


module.exports = {
    getAllGroups,
    createGroup,
    deleteGroup,
    updateGroup
};