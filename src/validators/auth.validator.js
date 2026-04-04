const Joi = require('joi');

const passwordSchema = Joi.string()
  .min(8)
  .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])'))
  .messages({
    'string.min': 'Mật khẩu phải có ít nhất 8 ký tự.',
    'string.pattern.base': 'Mật khẩu phải bao gồm cả chữ hoa, chữ thường, chữ số và ký tự đặc biệt (!@#$%^&*).',
  });

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required().messages({
    'any.required': 'Vui lòng nhập mật khẩu hiện tại.',
  }),
  newPassword: passwordSchema.required(),
  confirmPassword: Joi.any()
    .equal(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Mật khẩu xác nhận không khớp.',
    }),
});

const setPasswordSchema = Joi.object({
  newPassword: passwordSchema.required(),
  confirmPassword: Joi.any()
    .equal(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Mật khẩu xác nhận không khớp.',
    }),
});

module.exports = {
  changePasswordSchema,
  setPasswordSchema,
};
