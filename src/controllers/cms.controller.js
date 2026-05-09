const Page = require('../models/Page.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { success } = require('../utils/apiResponse');

/**
 * GET /admin/cms/pages
 * Get all pages
 */
const getPages = catchAsync(async (req, res, next) => {
  const pages = await Page.find().sort({ updatedAt: -1 });
  return success(res, { pages }, 200, 'Lấy danh sách trang thành công.');
});

/**
 * GET /admin/cms/pages/:id
 * Get single page
 */
const getPage = catchAsync(async (req, res, next) => {
  const page = await Page.findById(req.params.id);
  if (!page) {
    return next(new AppError('Không tìm thấy trang.', 404));
  }
  return success(res, { page }, 200, 'Lấy thông tin trang thành công.');
});

/**
 * POST /admin/cms/pages
 * Create new page
 */
const createPage = catchAsync(async (req, res, next) => {
  const { title, slug, content, language, status, metadata } = req.body;
  
  const existingPage = await Page.findOne({ slug });
  if (existingPage) {
    return next(new AppError('Slug này đã tồn tại.', 400));
  }

  const page = await Page.create({
    title,
    slug,
    content,
    language,
    status,
    metadata,
    authorId: req.user.id,
  });

  return success(res, { page }, 201, 'Tạo trang mới thành công.');
});

/**
 * PATCH /admin/cms/pages/:id
 * Update page
 */
const updatePage = catchAsync(async (req, res, next) => {
  const { title, slug, content, language, status, metadata } = req.body;
  
  const page = await Page.findById(req.params.id);
  if (!page) {
    return next(new AppError('Không tìm thấy trang.', 404));
  }

  if (slug && slug !== page.slug) {
    const existingPage = await Page.findOne({ slug });
    if (existingPage) {
      return next(new AppError('Slug này đã tồn tại.', 400));
    }
  }

  page.title = title || page.title;
  page.slug = slug || page.slug;
  page.content = content || page.content;
  page.language = language || page.language;
  page.status = status || page.status;
  page.metadata = metadata || page.metadata;

  await page.save();

  return success(res, { page }, 200, 'Cập nhật trang thành công.');
});

/**
 * DELETE /admin/cms/pages/:id
 * Delete page
 */
const deletePage = catchAsync(async (req, res, next) => {
  const page = await Page.findByIdAndDelete(req.params.id);
  if (!page) {
    return next(new AppError('Không tìm thấy trang.', 404));
  }
  return success(res, null, 200, 'Xóa trang thành công.');
});

module.exports = {
  getPages,
  getPage,
  createPage,
  updatePage,
  deletePage,
};
