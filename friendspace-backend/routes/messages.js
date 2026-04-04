const express = require('express');
const Message = require('../models/Message');
const Room = require('../models/Room');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/messages/:roomId - Get messages for a room
router.get('/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before } = req.query;

    // Verify user is member of the room
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const isMember = room.members.some(m => m.user.toString() === req.userId.toString());
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    let query = { roomId, isDeleted: false };
    if (before) {
      query._id = { $lt: before };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'username displayName avatar status')
      .populate('replyTo', 'content sender')
      .populate('reactions.user', 'username displayName')
      .populate('readBy.user', 'username displayName');

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/messages/:roomId - Send a message
router.post('/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content, type = 'text', replyTo } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Verify user is member of the room
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const isMember = room.members.some(m => m.user.toString() === req.userId.toString());
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    // Handle auto-delete
    let expiresAt = null;
    if (room.settings?.autoDelete) {
      const hours = room.settings.deleteAfter || 24;
      expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    }

    const message = await Message.create({
      roomId,
      sender: req.userId,
      content,
      type,
      replyTo: replyTo || null,
      expiresAt,
      readBy: [{ user: req.userId }]
    });

    // Populate the message
    await message.populate('sender', 'username displayName avatar status');
    if (replyTo) {
      await message.populate('replyTo', 'content sender');
    }

    // Update room's last message
    room.lastMessage = message._id;
    await room.save();

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/messages/:messageId/react - Add reaction to message
router.post('/:messageId/react', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Toggle reaction - remove if already exists, add if not
    const existingReaction = message.reactions.find(
      r => r.user.toString() === req.userId.toString() && r.emoji === emoji
    );

    if (existingReaction) {
      message.reactions = message.reactions.filter(
        r => !(r.user.toString() === req.userId.toString() && r.emoji === emoji)
      );
    } else {
      message.reactions.push({ user: req.userId, emoji });
    }

    await message.save();
    await message.populate('reactions.user', 'username displayName');

    res.json({ message });
  } catch (error) {
    console.error('React to message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/messages/:messageId - Delete a message
router.delete('/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.sender.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Can only delete your own messages' });
    }

    message.isDeleted = true;
    message.content = 'This message was deleted';
    await message.save();

    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
