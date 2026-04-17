import { TooltipComponent } from '@syncfusion/ej2-react-popups';
import React, { useEffect } from 'react';
import { AiOutlineMenu } from 'react-icons/ai';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { RiNotification3Line } from 'react-icons/ri';
import { MdDarkMode, MdLightMode } from 'react-icons/md';

import Cart from './Cart';
import Chat from './Chat';
import Notification from './Notification';   // ✅ water alerts dropdown
import UserProfile from './UserProfile';
import LanguageSwitcher from './LanguageSwitcher';
import { useStateContext } from '../contexts/ContextProvider';
import avatar from '../data/JR3.png';

const NavButton = ({ title, customFunc, icon, color, dotColor }) => (
  <TooltipComponent content={title} position="BottomCenter">
    <button
      type="button"
      onClick={() => customFunc()}
      style={{ color }}
      className="relative text-xl rounded-full p-3 hover:bg-light-gray"
    >
      {dotColor && (
        <span
          style={{ background: dotColor }}
          className="absolute inline-flex rounded-full h-2 w-2 right-2 top-2"
        />
      )}
      {icon}
    </button>
  </TooltipComponent>
);

const Navbar = () => {
  const {
    currentColor,
    activeMenu,
    setActiveMenu,
    handleClick,
    isClicked,
    setScreenSize,
    screenSize,
    currentMode,
    setCurrentMode,
  } = useStateContext();

  const isDark = currentMode === 'Dark';
  const toggleMode = () => {
    const next = isDark ? 'Light' : 'Dark';
    setCurrentMode(next);
    localStorage.setItem('themeMode', next);
  };

  useEffect(() => {
    const handleResize = () => setScreenSize(window.innerWidth);

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (screenSize <= 900) {
      setActiveMenu(false);
    } else {
      setActiveMenu(true);
    }
  }, [screenSize]);

  const handleActiveMenu = () => setActiveMenu(!activeMenu);

  return (
    <div className="flex justify-between p-2 md:ml-6 md:mr-6 relative border-b border-gray-100 dark:border-gray-700/50">

      {/* Left Side - Menu button */}
      <NavButton
        title="Menu"
        customFunc={handleActiveMenu}
        color={currentColor}
        icon={<AiOutlineMenu />}
      />

      {/* Right Side */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <TooltipComponent content={isDark ? 'Light Mode' : 'Dark Mode'} position="BottomCenter">
          <button
            type="button"
            onClick={toggleMode}
            aria-label="Toggle theme"
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: currentColor,
              fontSize: 18,
              transition: 'background 0.2s',
            }}
          >
            {isDark ? <MdLightMode /> : <MdDarkMode />}
          </button>
        </TooltipComponent>

        <LanguageSwitcher />

        {/* ✅ Notification Icon (Water Alerts) */}
        <NavButton
          title="Notification"
          dotColor="rgb(254, 201, 15)"
          customFunc={() => handleClick('notification')}
          color={currentColor}
          icon={<RiNotification3Line />}
        />

        {/* Profile */}
        <TooltipComponent content="Profile" position="BottomCenter">
          <div
            className="flex items-center gap-2 cursor-pointer p-1 hover:bg-light-gray rounded-lg transition-colors"
            onClick={() => handleClick('userProfile')}
          >
            <img
              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
              src={avatar}
              alt="user-profile"
            />
            <MdKeyboardArrowDown className="text-gray-400 text-14" />
          </div>
        </TooltipComponent>

        {/* Popups */}
        {isClicked.cart && <Cart />}
        {isClicked.chat && <Chat />}
        {isClicked.notification && <Notification />}  {/* ✅ water-related dropdown */}
        {isClicked.userProfile && <UserProfile />}
      </div>
    </div>
  );
};

export default Navbar;
