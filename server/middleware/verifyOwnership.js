const mongoose = require('mongoose');

/**
 * verifyOwnership middleware factory
 * Usage: router.get('/route/:id', verifyToken, verifyOwnership(Model, 'userId'), handler)
 */
const verifyOwnership = (Model, ownerField = 'userId') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id;
      if (!resourceId) {
        return res.status(400).json({ message: 'Resource ID parameter is missing.' });
      }

      if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        return res.status(400).json({ message: 'Invalid Resource ID.' });
      }

      const resource = await Model.findById(resourceId);
      if (!resource) {
        return res.status(404).json({ message: 'Resource not found.' });
      }

      const ownerId = resource[ownerField];
      if (!ownerId) {
        return res.status(403).json({ message: 'Access denied. Resource owner not found.' });
      }

      const userIdStr = req.user.id;
      if (Array.isArray(ownerId)) {
        if (!ownerId.some(id => id.toString() === userIdStr)) {
          return res.status(403).json({ message: 'Access denied. You do not have access to this resource.' });
        }
      } else {
        if (ownerId.toString() !== userIdStr) {
          return res.status(403).json({ message: 'Access denied. You do not own this resource.' });
        }
      }

      req.resource = resource;
      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = verifyOwnership;
