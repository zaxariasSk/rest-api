const {validationResult} = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user');

exports.signup = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error('Something went wrong');
        error.statusCode = 422;
        errors.data = errors.array();
        throw errors;
    }

    const email = req.body.email;
    const name = req.body.name;
    const password = req.body.password;

    bcrypt.hash(password, 12)
          .then(hashed => {
              const user = new User({
                  email,
                  password: hashed,
                  name
              });

              return user.save();
          })
          .then(result => {
              res.status(201)
                 .json({
                     message: 'User created',
                     userId: result._id
                 })
          })
          .catch(err => {
              if (!err.statusCode) {
                  err.statusCode = 500;
              }
              next(err);
          })
};

exports.login = (req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;
    let loadedUser;

    User.findOne({email: email})
        .then(user => {
            if (!user) {
                const error = new Error('A User with this email can not be found.');
                error.statusCode = 401;
                throw error;
            }
            loadedUser = user;
            return bcrypt.compare(password, user.password);
        })
        .then(isEqual => {
            if (!isEqual) {
                const error = new Error('Wrong password!');
                error.statusCode = 401;
                throw error;
            }

            // Dimiourgo jwt token me tis plirofories tou email kai tou user id. Bazo ena secretkey pou sinithos prepei na einai ena megalo string kai meta tou leo se posi wra tha kanei expire
            // sti sinexeia to stelno sto front-end opou ekei prepei na soso to token mou eite se session ston server pou sinithos einai to pio swsto eite se localStorage sto client side
            const token = jwt.sign({
                    email: loadedUser.email,
                    userId: loadedUser._id.toString()
                }, 'someSecretKey',
                {expiresIn: '1h'});

            res.status(200)
               .json({
                   token: token,
                   userId: loadedUser._id.toString()
               });

        })
        .catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        })
};


exports.getUserStatus = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            const error = new Error('User not found.');
            error.statusCode = 404;
            throw error;
        }
        res.status(200)
           .json({status: user.status});
    } catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};

exports.updateUserStatus = async (req, res, next) => {
    const newStatus = req.body.status;
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            const error = new Error('User not found.');
            error.statusCode = 404;
            throw error;
        }
        user.status = newStatus;
        await user.save();
        res.status(200)
           .json({message: 'User updated.'});
    } catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};
