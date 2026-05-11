const AuditLog = require('../models/AuditLog.model');
const catchAsync = require('./catchAsync');

/**
 * Middleware to log admin actions
 * @param {string} action - The action name (e.g., 'ADD_BLACKLIST_WORD')
 * @param {string} targetModel - The model being affected
 */
const auditLog = (action, targetModel) => {
  return catchAsync(async (req, res, next) => {
    // We capture the response to log after success
    const originalSend = res.send;

    res.send = function (data) {
      // Only log successful actions (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const responseBody = JSON.parse(data);
          
          // Details can be from request body or response data
          const details = {
            requestBody: req.body,
            responseData: responseBody.data || responseBody,
          };

          const targetId = req.params.id || (responseBody.data && responseBody.data._id);

          AuditLog.create({
            adminId: req.user.id,
            action,
            targetId: targetId ? targetId.toString() : null,
            targetModel,
            details,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
          }).catch(err => console.error('Error creating audit log:', err));
        } catch (err) {
          console.error('Error parsing response for audit log:', err);
        }
      }
      
      originalSend.apply(res, arguments);
    };

    next();
  });
};

module.exports = auditLog;
