const express = require('express');
const Room = require('../models/Room');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/rooms - Get all rooms for the current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const rooms = await Room.find({
      'members.user': req.userId,
      isActive: true
    })
      .populate('members.user', 'username displayName avatar status lastSeen')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    // Populate lastMessage sender
    await Room.populate(rooms, {
      path: 'lastMessage',
      populate: { path: 'sender', select: 'username displayName' }
    });

    res.json({ rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/rooms/dm/:userId - Create or get a DM room
router.post('/dm/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.userId.toString()) {
      return res.status(400).json({ error: 'Cannot create DM with yourself' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser || !targetUser.isAuthorized) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if DM already exists between these two users
    const existingRoom = await Room.findOne({
      type: 'dm',
      isActive: true,
      $and: [
        { 'members.user': req.userId },
        { 'members.user': userId }
      ]
    })
      .populate('members.user', 'username displayName avatar status lastSeen')
      .populate('lastMessage');

    if (existingRoom) {
      return res.json({ room: existingRoom });
    }

    // Create new DM room
    const currentUser = await User.findById(req.userId);
    const room = await Room.create({
      name: `${currentUser.displayName} & ${targetUser.displayName}`,
      type: 'dm',
      members: [
        { user: req.userId, role: 'member' },
        { user: userId, role: 'member' }
      ]
    });

    await room.populate('members.user', 'username displayName avatar status lastSeen');

    res.status(201).json({ room });
  } catch (error) {
    console.error('Create DM error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/rooms/group - Create a group room
router.post('/group', authMiddleware, async (req, res) => {
  try {
    const { name, memberIds, settings } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    // Always include the creator
    const allMemberIds = [...new Set([req.userId.toString(), ...(memberIds || [])])];

    const members = allMemberIds.map(id => ({
      user: id,
      role: id === req.userId.toString() ? 'admin' : 'member'
    }));

    const room = await Room.create({
      name,
      type: 'group',
      members,
      settings: settings || {}
    });

    await room.populate('members.user', 'username displayName avatar status lastSeen');

    res.status(201).json({ room });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/rooms/:roomId/settings - Update room settings
router.patch('/:roomId/settings', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const isMember = room.members.some(m => m.user.toString() === req.userId.toString());
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    // Update settings
    if (req.body.autoDelete !== undefined) room.settings.autoDelete = req.body.autoDelete;
    if (req.body.deleteAfter !== undefined) room.settings.deleteAfter = req.body.deleteAfter;
    if (req.body.allowReactions !== undefined) room.settings.allowReactions = req.body.allowReactions;

    await room.save();
    await room.populate('members.user', 'username displayName avatar status lastSeen');

    res.json({ room });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/rooms/:roomId/members - Add member to room
router.post('/:roomId/members', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    const room = await Room.findById(roomId);
    if (!room || room.type !== 'group') {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if requester is admin
    const requesterMember = room.members.find(m => m.user.toString() === req.userId.toString());
    if (!requesterMember || requesterMember.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can add members' });
    }

    // Check if user already in room
    const alreadyMember = room.members.some(m => m.user.toString() === userId);
    if (alreadyMember) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    room.members.push({ user: userId, role: 'member' });
    await room.save();
    await room.populate('members.user', 'username displayName avatar status lastSeen');

    res.json({ room });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/rooms/:roomId/leave - Leave a room
router.post('/:roomId/leave', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    room.members = room.members.filter(m => m.user.toString() !== req.userId.toString());

    if (room.members.length === 0) {
      room.isActive = false;
    }

    await room.save();
    res.json({ message: 'Left room successfully' });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
