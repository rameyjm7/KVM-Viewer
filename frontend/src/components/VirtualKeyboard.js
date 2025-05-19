// VirtualKeyboard.jsx

import React, { useState, useEffect, useRef } from 'react';
import Keyboard from 'react-simple-keyboard';
import axios from 'axios';
import 'react-simple-keyboard/build/css/index.css';
import './VirtualKeyboard.css';

export default function VirtualKeyboard() {
  const keyboard = useRef();

  // Modifier states
  const [capsOn,    setCapsOn]    = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [ctrlHeld,  setCtrlHeld]  = useState(false);

  // Highlight theme
  const [buttonTheme, setButtonTheme] = useState([]);

  const url = `http://${window.location.hostname}:5000/keypress`;

  // Layout definitions
  const layouts = {
    default: [
      "` 1 2 3 4 5 6 7 8 9 0 - = {bksp}",
      "{tab} q w e r t y u i o p [ ] \\",
      "{lock} a s d f g h j k l ; ' {enter}",
      "{ctrl} {shift} z x c v b n m , . / {shift}",
      ".com @ {space}"
    ],
    shift: [
      "~ ! @ # $ % ^ & * ( ) _ + {bksp}",
      "{tab} Q W E R T Y U I O P { } |",
      "{lock} A S D F G H J K L : \" {enter}",
      "{ctrl} {shift} Z X C V B N M < > ? {shift}",
      ".com @ {space}"
    ],
    caps: [
      "` 1 2 3 4 5 6 7 8 9 0 - = {bksp}",
      "{tab} Q W E R T Y U I O P [ ] \\",
      "{lock} A S D F G H J K L ; ' {enter}",
      "{ctrl} {shift} Z X C V B N M , . / {shift}",
      ".com @ {space}"
    ]
  };

  // Determine which layout to render
  const layoutName = shiftHeld
    ? 'shift'
    : capsOn
      ? 'caps'
      : 'default';

  // Add or remove a pressed highlight
  const flash = (btn) => {
    setButtonTheme(t => [...t, { class: 'hg-pressed', buttons: btn }]);
    setTimeout(() => {
      setButtonTheme(t => t.filter(x => x.buttons !== btn));
    }, 200);
  };

  // Send key event to backend
  const sendEvent = (keyName, action) => {
    axios.post(url, {
      key: keyName,
      action,          // "down" or "up"
      ctrl: ctrlHeld,
      shift: shiftHeld,
      caps:  capsOn
    }).catch(console.error);
  };

  // Handle any key-down
  const handleKeyDown = (button) => {
    // Normalize raw to logical button
    let raw = button;
    if (raw === '{space}')  raw = 'Space';
    else if (raw === '{enter}') raw = 'Enter';
    else if (raw === '{bksp}')  raw = 'Backspace';
    else if (raw === '{tab}')   raw = 'Tab';
    else if (/^[a-z]$/i.test(raw)) {
      // letters: apply case
      if (shiftHeld || capsOn) raw = raw.toUpperCase();
      else                     raw = raw.toLowerCase();
    }

    // Manage modifiers
    if (button === '{shift}') {
      setShiftHeld(true);
      flash('{shift}');
      sendEvent('Shift', 'down');
      return;
    }
    if (button === '{ctrl}') {
      setCtrlHeld(true);
      flash('{ctrl}');
      sendEvent('Control', 'down');
      return;
    }
    if (button === '{lock}') {
      setCapsOn(c => !c);
      flash('{lock}');
      sendEvent('CapsLock', 'down');
      sendEvent('CapsLock', 'up');
      return;
    }

    // Non-modifier key
    flash(button);
    sendEvent(raw, 'down');
  };

  // Handle any key-up
  const handleKeyUp = (button) => {
    let raw = button;
    if (button === '{shift}') {
      setShiftHeld(false);
      sendEvent('Shift', 'up');
      return;
    }
    if (button === '{ctrl}') {
      setCtrlHeld(false);
      sendEvent('Control', 'up');
      return;
    }

    if (raw === '{space}')  raw = 'Space';
    else if (raw === '{enter}') raw = 'Enter';
    else if (raw === '{bksp}')  raw = 'Backspace';
    else if (raw === '{tab}')   raw = 'Tab';
    else if (/^[a-z]$/i.test(raw)) {
      if (shiftHeld || capsOn) raw = raw.toUpperCase();
      else                     raw = raw.toLowerCase();
    }

    sendEvent(raw, 'up');
  };

  // on-screen callbacks
  const onKeyPress   = btn => handleKeyDown(btn);
  const onKeyRelease = btn => handleKeyUp(btn);

  // Physical keyboard listeners
  useEffect(() => {
    const onDown = e => {
      if (e.repeat) return;
      let btn = e.key;
      if (btn === ' ')           btn = '{space}';
      else if (btn === 'Enter')  btn = '{enter}';
      else if (btn === 'Backspace') btn = '{bksp}';
      else if (btn === 'Tab')    btn = '{tab}';
      else if (btn === 'Shift')  btn = '{shift}';
      else if (btn === 'Control')btn = '{ctrl}';
      else if (btn === 'CapsLock') btn = '{lock}';
      else                       btn = btn.toLowerCase();

      if (keyboard.current.getButtonElement(btn)) {
        handleKeyDown(btn);
      }
    };
    const onUp = e => {
      let btn = e.key;
      if (btn === ' ')           btn = '{space}';
      else if (btn === 'Enter')  btn = '{enter}';
      else if (btn === 'Backspace') btn = '{bksp}';
      else if (btn === 'Tab')    btn = '{tab}';
      else if (btn === 'Shift')  btn = '{shift}';
      else if (btn === 'Control')btn = '{ctrl}';
      else if (btn === 'CapsLock') btn = '{lock}';
      else                       btn = btn.toLowerCase();

      if (keyboard.current.getButtonElement(btn)) {
        handleKeyUp(btn);
      }
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup',   onUp);
    };
  }, [capsOn, shiftHeld, ctrlHeld]);

  return (
    <Keyboard
      keyboardRef={r => (keyboard.current = r)}
      theme="hg-theme-dark"
      layoutName={layoutName}
      layout={layouts}
      display={{
        '{bksp}': '⌫',
        '{tab}':  'Tab',
        '{enter}':'Enter',
        '{shift}':'Shift',
        '{lock}': 'Caps',
        '{ctrl}': 'Ctrl',
        '{space}':'Space'
      }}
      buttonTheme={buttonTheme}
      onKeyPress  ={onKeyPress}
      onKeyReleased={onKeyRelease}
      physicalKeyboardHighlight={false}
    />
  );
}
