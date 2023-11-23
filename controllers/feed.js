const fs = require('fs');
const path = require('path');

const {validationResult} = require('express-validator');
const io = require('../socket');
const Post = require('../models/post');
const User = require('../models/user');

exports.getPosts = async (req, res, next) => {
    const currentPage = req.query.page || 1;
    const perPage = 2;

    try {
        const totalItems = await Post.find()
                                     .countDocuments();

        const posts = await Post.find()
                                .skip((currentPage - 1) * perPage)
                                .limit(perPage);
        res.status(200)
           .json({
               message: 'Fetched posts successfully',
               posts: posts,
               totalItems
           });

    } catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};

exports.createPost = async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const error = new Error('Validation Failed, entered date is incorrect.');
        error.statusCode = 422;
        throw error;
    }

    if (!req.file) {
        const error = new Error('No image provided.');
        error.statusCode(422);
        throw error;
    }

    const imageUrl = req.file.path.replace("\\", "/");

    const title = req.body.title;
    const content = req.body.content;
    let creator;

    const post = new Post({
        title: title,
        content: content,
        imageUrl: imageUrl,
        creator: req.userId
    });

    post.save()
        .then(result => {
            return User.findById(req.userId);
        })
        .then(user => {
            user.posts.push(post);
            creator = user;
            return user.save();
        })
        .then(result => {
            io.getIO()
              .emit('posts', {
                  action: 'create',
                  post
              });

            res.status(201)
               .json({
                   message: 'Post created successfully!',
                   post: post,
                   creator: {
                       _id: creator._id,
                       name: creator.name
                   }
               });
        })
        .catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
};

exports.getPost = (req, res, next) => {
    const postId = req.params.postId;

    Post.findById(postId)
        .then(post => {
            if (!post) {
                const error = new Error('Could not find post');
                error.statusCode = 404;
                throw error;
            }
            res.status(200)
               .json({
                   message: 'Post Fetched',
                   post: post
               });
        })
        .catch(err => {
            if (!err.status) {
                err.statusCode = 500;
            }
            next(err);
        })
}

exports.updatePost = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const error = new Error('Validation Failed, entered date is incorrect.');
        error.statusCode = 422;
        throw error;
    }

    const postId = req.params.postId;
    const title = req.body.title;
    const content = req.body.content;
    let imageUrl = req.file.path.replace("\\", "/");

    if (req.file) {
        imageUrl = req.file.path;
    }

    if (!imageUrl) {
        const error = new Error('No file picked');
        error.statusCode = 422;
        throw error;
    }

    Post.findById(postId)
        .then(post => {
            if (!post) {
                const error = new Error('Could Not Fild Post');
                error.statusCode = 404;
                throw error;
            }
            if (post.creator.toString !== req.userId) {
                const error = new Error('Not authorized');
                error.statusCode = 403;
                throw error;
            }

            if (imageUrl !== post.imageUrl) {
                clearImage(post.imageUrl);
            }

            post.title = title;
            post.imageUrl = imageUrl;
            post.content = content;
            return post.save();
        })
        .then(result => {
            res.status(200)
               .json({
                   message: 'Post updated successfully',
                   post: result
               });
        })
        .catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
}

const clearImage = filePath => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, err => console.log(err));
}


exports.deletePost = (req, res, next) => {
    const postId = req.params.postId;

    Post.findById(postId)
        .then(post => {
            if (!post) {
                const error = new Error('Could not find post');
                error.statusCode = 404;
                throw error;
            }

            if (post.creator.toString() !== req.userId) {
                const error = new Error('Not authorized');
                error.statusCode = 403;
                throw error;
            }

            clearImage(post.imageUrl);
            return Post.findByIdAndRemove(postId);
        })
        .then(result => {
            return User.findById(req.userId);
        })
        .then(user => {
            user.posts.pull(postId);
            return user.save;
        })
        .then(result => {
            res.status(200)
               .json({message: 'Post deleted successfully'});
        })
        .catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        })
};
