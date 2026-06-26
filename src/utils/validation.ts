import Joi from "joi"

const registerJoiSchema = Joi.object({
    userName: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().alphanum().min(8).max(20).required(),
    email:Joi.string().email()
})
const loginJoiSchema = Joi.object({
    userName:Joi.string(),
    email:Joi.string().email(),
    password:Joi.string().required()
}).xor('userName', 'email');
const commentJoiSchema = Joi.object({
    content:Joi.string().max(500)
})