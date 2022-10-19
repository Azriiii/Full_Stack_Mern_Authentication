const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const validaEmail = require('../helpers/validateEmail');
const createToken = require('../helpers/createToken');
const sendMail = require('../helpers/sendMail');
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');
const { errorHandler } = require('../helpers/dbErrorHandling');
const { google } = require('googleapis');
const { OAuth2 } = google.auth;

sgMail.setApiKey(process.env.MAIL_KEY);

const userController = {
  register: async (req, res) => {
    try {
      const { name, avatar, email, password, lastname, phone } = req.body;
      if (!name || !email || !password || !lastname || !phone || !avatar)
        return res.status(400).json({ msg: 'Please fill all the fields' });
      if (!validaEmail(email))
        return res
          .status(400)
          .json({ msg: 'Please enter a valide email adress' });
      const user = await User.findOne({ email });
      if (user)
        return res.status(400).json({ msg: 'This Email already exists' });
      if (password.length < 6)
        return res
          .status(400)
          .json({ msg: 'Password must be at least 6 caracteres' });
      if (phone.length < 8)
        return res
          .status(400)
          .json({ msg: 'phone must be at least 6 numbers' });

      const salt = await bcrypt.genSalt();
      const hashPassword = await bcrypt.hash(password, salt);

      const newUser = {
        name,
        email,
        password: hashPassword,
        lastname,
        phone,
        avatar,
      };
      const activation_token = createToken.activation(newUser);

      //    const url = `http://localhost:3000/api/auth/activate/${activation_token}`;
      //  sendMail.sendEmailRegister(email, url, 'Verify Your Email');
      const emailData = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Account activation link',
        html: `
                <h1>Please use the following to activate your account</h1>
                <p>${process.env.CLIENT_URL}/api/auth/activate/${activation_token}</p>
                <hr />
                <p>This email may containe sensetive information</p>
                <p>${process.env.CLIENT_URL}</p>
            `,
      };
      sgMail
        .send(emailData)
        .then((sent) => {
          return res.json({
            message: `Email has been sent to ${email}`,
          });
        })
        .catch((err) => {
          return res.status(400).json({
            success: false,
            errors: errorHandler(err),
          });
        });
    } catch (err) {}
  },
  activate: async (req, res) => {
    try {
      const { activation_token } = req.body;
      const user = jwt.verify(activation_token, process.env.ACTIVATION_TOKEN);
      const { name, email, password, lastname, phone, avatar } = user;
      const check = await User.findOne({ email });
      if (check)
        return res.status(400).json({ msg: 'this email is already registred' });
      const newUser = new User({
        name,
        email,
        password,
        lastname,
        phone,
        avatar,
      });
      await newUser.save();
      res
        .status(200)
        .json({ msg: 'Your Account has been Activated You Can Sign in !' });
    } catch (err) {
      res.status(500).json({ msg: err.message });
    }
  },
  signing: async (req, res) => {
    try {
      // get cred
      const { email, password } = req.body;

      // check email
      const user = await User.findOne({ email });
      if (!user)
        return res
          .status(400)
          .json({ msg: 'This email is not registered in our system.' });

      // check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch)
        return res.status(400).json({ msg: 'This password is incorrect.' });

      // refresh token
      const rf_token = createToken.refresh({ id: user._id });
      res.cookie('_apprftoken', rf_token, {
        httpOnly: true,
        path: '/api/auth/access',
        maxAge: 24 * 60 * 60 * 1000, // 24h
      });

      // signing success
      res.status(200).json({ msg: 'Signing success' });
    } catch (err) {
      res.status(500).json({ msg: err.message });
    }
  },
  access: async (req, res) => {
    try {
      // rf token
      const rf_token = req.cookies._apprftoken;
      if (!rf_token) return res.status(400).json({ msg: 'Please sign in.' });

      // validate
      jwt.verify(rf_token, process.env.REFRESH_TOKEN, (err, user) => {
        if (err) return res.status(400).json({ msg: 'Please sign in again.' });
        // create access token
        const ac_token = createToken.access({ id: user.id });
        // access success
        return res.status(200).json({ ac_token });
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  forgot: async (req, res) => {
    try {
      // get email
      const { email } = req.body;

      // check email
      const user = await User.findOne({ email });
      if (!user)
        return res
          .status(400)
          .json({ msg: 'This email is not registered in our system.' });

      // create ac token
      const ac_token = createToken.access({ id: user.id });

      // send email
      //const url = `http://localhost:3000/auth/reset-password/${ac_token}`;
      //const name = user.name;
      //sendMail.sendEmailReset(email, url, 'Reset your password', name);
      const emailData = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: `Password Reset link`,
        html: `
                  <h1>Please use the following link to reset your password</h1>
                  <p>http://localhost:3000/auth/reset-password/${ac_token}</p>
                  <hr />
                  <p>This email may contain sensetive information</p>
                  <p>${process.env.CLIENT_URL}</p>
              `,
      };

      sgMail
        .send(emailData)
        .then((sent) => {
          // console.log('SIGNUP EMAIL SENT', sent)
          return res.json({
            message: `Email has been sent to ${email}. Follow the instruction to activate your account`,
          });
        })
        .catch((err) => {
          // console.log('SIGNUP EMAIL SENT ERROR', err)
          return res.json({
            message: err.message,
          });
        });

      // success
    } catch (err) {
      res.status(500).json({ msg: err.message });
    }
  },
  reset: async (req, res) => {
    try {
      // get password
      const { password } = req.body;

      // hash password
      const salt = await bcrypt.genSalt();
      const hashPassword = await bcrypt.hash(password, salt);

      // update password
      await User.findOneAndUpdate(
        { _id: req.user.id },
        { password: hashPassword }
      );

      // reset success
      res.status(200).json({ msg: 'Password was updated successfully.' });
    } catch (err) {
      res.status(500).json({ msg: err.message });
    }
  },
  info: async (req, res) => {
    try {
      // get info -password
      const user = await User.findById(req.user.id).select('-password');
      // return user
      res.status(200).json(user);
    } catch (err) {
      res.status(500).json({ msg: err.message });
    }
  },
  update: async (req, res) => {
    try {
      // get info
      const { name, avatar, lastname, phone } = req.body;

      // update
      await User.findOneAndUpdate(
        { _id: req.user.id },
        { name, avatar, lastname, phone }
      );
      // success
      res.status(200).json({ msg: 'Update success.' });
    } catch (err) {
      res.status(500).json({ msg: err.message });
    }
  },
  signout: async (req, res) => {
    try {
      // clear cookie
      res.clearCookie('_apprftoken', { path: '/api/auth/access' });
      // success
      return res.status(200).json({ msg: 'Signout success.' });
    } catch (err) {
      res.status(500).json({ msg: err.message });
    }
  },
  google: async (req, res) => {
    try {
      // get Token Id
      const { tokenId } = req.body;

      // verify Token Id
      const client = new OAuth2(process.env.G_CLIENT_ID);
      const verify = await client.verifyIdToken({
        idToken: tokenId,
        audience: process.env.G_CLIENT_ID,
      });

      // get data
      const { email_verified, email, name, picture, lastname } = verify.payload;

      // failed verification
      if (!email_verified)
        return res.status(400).json({ msg: 'Email verification failed.' });

      // passed verification
      const user = await User.findOne({ email });
      // 1. If user exist / sign in
      if (user) {
        // refresh token
        const rf_token = createToken.refresh({ id: user._id });
        // store cookie
        res.cookie('_apprftoken', rf_token, {
          httpOnly: true,
          path: '/api/auth/access',
          maxAge: 24 * 60 * 60 * 1000, // 24hrs
        });
        res.status(200).json({ msg: 'Signing with Google success.' });
      } else {
        // new user / create user
        const password = email + process.env.G_CLIENT_ID;
        const salt = await bcrypt.genSalt();
        const hashPassword = await bcrypt.hash(password, salt);
        const newUser = new User({
          name,
          email,
          password: hashPassword,
          avatar: picture,
          lastname,
        });
        await newUser.save();
        // sign in the user
        // refresh token
        const rf_token = createToken.refresh({ id: user._id });
        // store cookie
        res.cookie('_apprftoken', rf_token, {
          httpOnly: true,
          path: '/api/auth/access',
          maxAge: 24 * 60 * 60 * 1000, // 24hrs
        });
        // success
        res.status(200).json({ msg: 'Signing with Google success.' });
      }
    } catch (err) {
      res.status(500).json({ msg: err.message });
    }
  },
};

module.exports = userController;
