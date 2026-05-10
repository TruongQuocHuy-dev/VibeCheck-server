const express = require('express');
const cmsController = require('../controllers/cms.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { restrictTo } = require('../middlewares/restrictTo.middleware');

const router = express.Router();

// Only admins can access CMS routes
router.use(authenticate);
router.use(restrictTo('admin'));

router.route('/pages')
  .get(cmsController.getPages)
  .post(cmsController.createPage);

router.route('/pages/:id')
  .get(cmsController.getPage)
  .patch(cmsController.updatePage)
  .delete(cmsController.deletePage);

router.get('/pages/:id/versions', cmsController.getPageVersions);

module.exports = router;
