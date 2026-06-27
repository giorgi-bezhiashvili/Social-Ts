import Joi from "joi"

export const registerJoiSchema = Joi.object({
    userName: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().alphanum().min(8).max(20).required(),
    email:Joi.string().email()
})
export const loginJoiSchema = Joi.object({
    userName:Joi.string(),
    email:Joi.string().email(),
    password:Joi.string().required()
}).xor('userName', 'email');
export const commentAndDescriptionJoiSchema = Joi.object({
    content:Joi.string().max(500)
})
export const postJoiSchema = Joi.object({
    title:Joi.string(),
    description:Joi.string()
})
