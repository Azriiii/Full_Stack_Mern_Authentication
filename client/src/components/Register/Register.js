import Input from '../Input/Input.js';
import { MdVisibility } from 'react-icons/md';
import { MdVisibilityOff } from 'react-icons/md';
import { useRef, useState, useContext } from 'react';
import Avatar from '../Avatar/Avatar';
import { AiFillCamera } from 'react-icons/ai';
import { AuthContext } from '../../context/AuthContext';
import { isEmpty, isEmail, isLength, isMatch } from '../helper/validate';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const initialState = {
  name: '',
  lastname: '',
  phone: '',
  email: '',
  password: '',
  cf_password: '',
};
const Register = () => {
  const inputFile = useRef(null);
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState(initialState);
  const [avatar, setAvatar] = useState(false);
  const { name, lastname, phone, email, password, cf_password } = data;
  const { user, token, dispatch } = useContext(AuthContext);

  const handleInput = () => {
    inputFile.current.click();
  };

  const handleChange = (e) => {
    setData({ ...data, [e.target.name]: e.target.value });
  };
  const handleClick = () => {
    setVisible(!visible);
  };
  const changeAvatar = async (e) => {
    e.preventDefault();
    try {
      // get file
      const file = e.target.files[0];
      let formData = new FormData();
      formData.append('avatar', file);

      // upload to cloudinary
      /*const res = await axios.post('/api/upload', formData, {
        headers: {
          'content-type': 'multipart/form-data',
          Authorization: token,
        },*/
      const res = await axios.post('/api/uploads', formData, {
        headers: {
          'content-type': 'multipart/form-data',
        },
        onUploadProgress: (x) => {
          if (x.total < 1024000)
            return toast('Uploading', {
              className: 'bg-upload',
              bodyClassName: 'bg-upload',
              autoClose: 7000,
            });
        },
      });
      setAvatar(res.data.url);
    } catch (err) {
      toast(err.response.data.msg, {
        className: 'toast-failed',
        bodyClassName: 'toast-failed',
      });
    }
  };
  const register = async (e) => {
    e.preventDefault();
    // check fields
    if (isEmpty(name) || isEmpty(password))
      return toast('Please fill in all fields.', {
        className: 'toast-failed',
        bodyClassName: 'toast-failed',
      });
    // check email
    if (!isEmail(email))
      return toast('Please enter a valid email address.', {
        className: 'toast-failed',
        bodyClassName: 'toast-failed',
      });

    // check password
    if (isLength(password))
      return toast('Password must be at least 6 characters.', {
        className: 'toast-failed',
        bodyClassName: 'toast-failed',
      });
    // check match
    if (!isMatch(password, cf_password))
      return toast('Password did not match.', {
        className: 'toast-failed',
        bodyClassName: 'toast-failed',
      });
    try {
      const res = await axios.post('/api/auth/register', {
        name,
        avatar,
        lastname,
        phone,
        email,
        password,
      });
      toast(await res.data.msg, {
        className: 'toast-success',
        bodyClassName: 'toast-success',
      });
    } catch (err) {
      toast(err.response.data.msg, {
        className: 'toast-failed',
        bodyClassName: 'toast-failed',
      });
    }
    handleReset();
  };

  const handleReset = () => {
    Array.from(document.querySelectorAll('input')).forEach(
      (input) => (input.value = '')
    );
    setData({
      ...data,
      name: '',
      avatar: '',
      lastname: '',
      phone: '',
      email: '',
      password: '',
      cf_password: '',
    });
  };

  return (
    <>
      <ToastContainer />
      <div className='profile_avatar'>
        <div className='profile_avatar-wrapper' onClick={handleInput}>
          <Avatar avatar={avatar} />
          <AiFillCamera />
        </div>
        <input
          type='file'
          name='avatar'
          ref={inputFile}
          className='profile_avatar-input'
          onChange={changeAvatar}
        />
      </div>
      <form onSubmit={register}>
        <Input
          type='text'
          text='Name'
          name='name'
          handleChange={handleChange}
        />
        <Input
          type='text'
          text='LastName'
          name='lastname'
          handleChange={handleChange}
        />
        <Input
          type='text'
          text='Phone'
          name='phone'
          handleChange={handleChange}
        />
        <Input
          type='text'
          text='Email'
          name='email'
          handleChange={handleChange}
        />
        <Input
          name='password'
          type={visible ? 'text' : 'password'}
          icon={visible ? <MdVisibility /> : <MdVisibilityOff />}
          text='Password'
          handleClick={handleClick}
          handleChange={handleChange}
        />
        <Input
          name='cf_password'
          type={visible ? 'text' : 'password'}
          icon={visible ? <MdVisibility /> : <MdVisibilityOff />}
          text='Confirm Password'
          handleClick={handleClick}
          handleChange={handleChange}
        />
        <div className='login_btn'>
          <button type='submit'>register</button>
        </div>
      </form>
    </>
  );
};

export default Register;
