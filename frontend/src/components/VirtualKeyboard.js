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

  const layoutName = shiftHeld
    ? 'shift'
    : capsOn
      ? 'caps'
      : 'default';

  const flash = btn => {
    setButtonTheme(t => [...t, { class: 'hg-pressed', buttons: btn }]);
    setTimeout(() => {
      setButtonTheme(t => t.filter(x => x.buttons !== btn));
    }, 200);
  };

  const sendEvent = (keyName, action) => {
    axios.post(url, {
      key:   keyName,
      action,           // "down" or "up"
      ctrl:  ctrlHeld,
      shift: shiftHeld,
      caps:  capsOn
    }).catch(console.error);
  };

  const handleKeyDown = button => {
    // strip braces for tokens, leave single-char keys as-is
    let raw = button.startsWith('{') && button.endsWith('}')
      ? button.slice(1, -1)
      : button;

    // map a few named tokens
    if (raw === 'space')    raw = 'Space';
    else if (raw === 'enter') raw = 'Enter';
    else if (raw === 'bksp')  raw = 'Backspace';
    else if (raw === 'tab')   raw = 'Tab';

    // letters: apply case
    else if (/^[a-z]$/i.test(raw)) {
      raw = (shiftHeld || capsOn)
        ? raw.toUpperCase()
        : raw.toLowerCase();
    }

    // modifiers
    if (button === '{shift}') {
      setShiftHeld(true); flash('{shift}');
      sendEvent('Shift', 'down');
      return;
    }
    if (button === '{ctrl}') {
      setCtrlHeld(true); flash('{ctrl}');
      sendEvent('Control', 'down');
      return;
    }
    if (button === '{lock}') {
      setCapsOn(c => !c); flash('{lock}');
      sendEvent('CapsLock', 'down');
      sendEvent('CapsLock', 'up');
      return;
    }

    // any other key (digits, punctuation) falls through as raw
    flash(button);
    sendEvent(raw, 'down');
  };

  const handleKeyUp = button => {
    // strip braces for tokens
    let raw = button.startsWith('{') && button.endsWith('}')
      ? button.slice(1, -1)
      : button;

    // handle modifiers
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

    // map named tokens
    if (raw === 'space')    raw = 'Space';
    else if (raw === 'enter') raw = 'Enter';
    else if (raw === 'bksp')  raw = 'Backspace';
    else if (raw === 'tab')   raw = 'Tab';

    // letters: apply case
    else if (/^[a-z]$/i.test(raw)) {
      raw = (shiftHeld || capsOn)
        ? raw.toUpperCase()
        : raw.toLowerCase();
    }

    // send release
    sendEvent(raw, 'up');
  };

  const onKeyPress   = btn => handleKeyDown(btn);
  const onKeyRelease = btn => handleKeyUp(btn);

  useEffect(() => {
    const onDown = e => {
      if (e.repeat) return;
      let btn = e.key;
      if (btn === ' ')            btn = '{space}';
      else if (btn === 'Enter')   btn = '{enter}';
      else if (btn === 'Backspace') btn = '{bksp}';
      else if (btn === 'Tab')     btn = '{tab}';
      else if (btn === 'Shift')   btn = '{shift}';
      else if (btn === 'Control') btn = '{ctrl}';
      else if (btn === 'CapsLock') btn = '{lock}';
      else                        btn = btn.toLowerCase();

      if (keyboard.current.getButtonElement(btn)) {
        handleKeyDown(btn);
      }
    };
    const onUp = e => {
      let btn = e.key;
      if (btn === ' ')            btn = '{space}';
      else if (btn === 'Enter')   btn = '{enter}';
      else if (btn === 'Backspace') btn = '{bksp}';
      else if (btn === 'Tab')     btn = '{tab}';
      else if (btn === 'Shift')   btn = '{shift}';
      else if (btn === 'Control') btn = '{ctrl}';
      else if (btn === 'CapsLock') btn = '{lock}';
      else                        btn = btn.toLowerCase();

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
      onKeyPress={onKeyPress}
      onKeyReleased={onKeyRelease}
      physicalKeyboardHighlight={false}
    />
  );
}
