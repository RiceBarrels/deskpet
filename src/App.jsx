import { useState, useEffect } from "react";
// import reactLogo from "./assets/react.svg"; // Likely unused now
import { invoke } from "@tauri-apps/api/core";
// Import the listen function from tauri events
import { listen } from '@tauri-apps/api/event'
// Import the JSON data directly
import charStatesData from "@/assets/charState.json";
import "./App.css";
import Card from "./ui/Card";
import { motion,AnimatePresence } from "motion/react"
import Button from "./ui/button";
import Input from "./ui/Input";

export default function App() {
  const [charState, setCharState] = useState("frontIdle")
  const [isMoving, setIsMoving] = useState(false)
  const [isPressing, setIsPressing] = useState(false)
  const [direction, setDirection] = useState('left')
  const [windowPos,setWindowPos] = useState({
    x:0,
    y:0,
    width:0,
    height:0
  })
  const [screenSize,setScreenSize] = useState({
    width: 0,
    height:0
  })
  const [isHiding,setIsHiding] = useState(false)
  const [isTalkMenuOpen,setIsTalkMenuOpen] = useState(false)
  const [isContextMenuOpen,setIsContextMenuOpen] = useState(false)
  const [delayedImg, setDelayedImg] = useState(null);
  const [menuPosition, setMenuPosition] = useState("left")
  const [charPosition, setCharPosition] = useState("right")
  const [inputValue, setInputValue] = useState("")

  // Add function to get window info
  const getWindowInfo = async () => {
    try {
      const [x, y, screenWidth, screenHeight, windowWidth, windowHeight] = await invoke('get_window_info');
      setWindowPos({ x, y, width: windowWidth, height: windowHeight });
      setScreenSize({ width: screenWidth, height: screenHeight });
    } catch (error) {
      console.error('Failed to get window info:', error);
    }
  };

  // Add useEffect to get window info on mount and when window moves
  useEffect(() => {
    getWindowInfo();
    
    // Set up an interval to update window info periodically
    const interval = setInterval(getWindowInfo, 60/1000);
    
    // Listen for window move events
    const unlisten = window.addEventListener('mousemove', getWindowInfo);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', unlisten);
    };
  }, []);

  // Find the data for the current state
  const currentStateData = charStatesData.find(s => s.state === charState);

  // Add this useEffect for the 100ms delay
  useEffect(() => {
    if (currentStateData && currentStateData.img) {
      const timer = setTimeout(() => {
        setDelayedImg(currentStateData.img);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setDelayedImg(null);
    }
  }, [currentStateData?.img]);

  const move = () =>{
    // Map the direction string to an integer
    const directionValue = direction === 'left' ? -5 : 5;
    // Pass the directionValue to the Rust command
    invoke('start_window_movement', { directionArg: directionValue })
      .then(() => console.log("start window movement, direction:", directionValue))
      .catch((err) => console.error("start window movement:", err));
  }

  const stop = () => {
    invoke('stop_window_movement')
      .then(() => console.log("stop window movement"))
      .catch((err) => console.error("stop window movement:", err));
  }

  const changeWindowSize = async (width, height) => {
    try {
      await invoke('change_window_size', { width, height });
      // Update local state after successful size change
      getWindowInfo();
    } catch (error) {
      console.error('Failed to change window size:', error);
    }
  };

  const changeWindowPos = async (x, y) => {
    try {
      await invoke('change_window_pos', { x, y });
      // Update local state after successful position change
      getWindowInfo();
    } catch (error) {
      console.error('Failed to change window position:', error);
    }
  };

  //character state detector
  const charStateDetect = () =>{

    if(!isPressing && !isHiding && !isTalkMenuOpen && !isContextMenuOpen){
      if(!isMoving){
        stop();
        setCharState('frontIdle')
      } else {
        move();
        if(direction === 'left'){
          setCharState("movingLeft")
        } else if(direction === "right"){
          setCharState("movingRight")
        }
      }
    } else if (isPressing){
      if(windowPos.x <= -72 ){
        setCharState("hideOnLeft")
        setIsHiding(true)
      }else if(screenSize.width - (windowPos.width + windowPos.x) <= -72){
        setCharState("hideOnRight")
        setIsHiding(true)
      }
      else{
        setIsHiding(false)
        setCharState("dragging")
      }
    }

    
  }

  useEffect(()=>{
    charStateDetect()
    // Add setMenuPosition and setCharPosition logic
    if (windowPos.x < 128 && menuPosition === "left") {
      setMenuPosition("right")
      setCharPosition("left")
    } else if (windowPos.x > screenSize.width - windowPos.width - 128 && menuPosition === "right") {
      setMenuPosition("left")
      setCharPosition("right")
    }

    if(windowPos.x < -94){
      changeWindowPos(-80,windowPos.y)
    } else if (windowPos.x > screenSize - windowPos.height + 94){
      changeWindowPos(-screenSize - windowPos.height + 94,windowPos.y)
    }
  },[windowPos])

  // Improved timer logic using useEffect
  useEffect(() => {
    let intervalId;
    if (!isPressing) {
      intervalId = setInterval(() => {
        // We use the functional form of setIsMoving to ensure we get the latest state
        setIsMoving(prevIsMoving => !prevIsMoving);
      }, 10000); // 10 seconds
    }

    // Cleanup function to clear the interval
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isPressing]); // Re-run this effect only when isPressing changes

  // Listen for direction changes from the backend
  useEffect(() => {
    let unlisten = null;
    const setupListener = async () => {
      unlisten = await listen('direction-changed', (event) => {
        console.log('Received direction change from backend:', event.payload);
        if (event.payload && typeof event.payload.direction === 'string') {
          setDirection(event.payload.direction); // State update is requested here
        }
      });
    };

    setupListener();

    // Cleanup function to unsubscribe from the event
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  useEffect(()=>{
    if (isTalkMenuOpen && !isContextMenuOpen) {
      changeWindowSize(384,300);
      setTimeout(()=>{
        changeWindowSize(384,224)
      },200);
      if(menuPosition==="left"){
        changeWindowPos(windowPos.x - 192*2, windowPos.y)
      }
    }
    else if (!isTalkMenuOpen && !isContextMenuOpen) {
      changeWindowSize(384,300)
      setTimeout(()=>{
        changeWindowSize(192,192)
      },200);
      if(menuPosition==="left"){
        setTimeout(()=>changeWindowPos(windowPos.x + 192*2, windowPos.y),200)
      }
    }
    else if(isContextMenuOpen && isTalkMenuOpen){
      setIsContextMenuOpen(false)
    }
  },[isTalkMenuOpen])

  useEffect(()=>{
    if(isContextMenuOpen && !isTalkMenuOpen){
      changeWindowSize(192+16*3,192);
      if(menuPosition==="left"){
        changeWindowPos(windowPos.x - 16*3*2, windowPos.y)
      }
    }
    else if(!isContextMenuOpen && !isTalkMenuOpen){
      setTimeout(()=>{
        changeWindowSize(192,192)
      },200);
      if(menuPosition==="left"){
        setTimeout(()=>changeWindowPos(windowPos.x + 16*3*2, windowPos.y),200)
      }
    } else if(isContextMenuOpen && isTalkMenuOpen){
      setIsTalkMenuOpen(false)
    }
  },[isContextMenuOpen])

  useEffect(()=>{
    if(isPressing && menuPosition === "left" && isTalkMenuOpen){
      changeWindowPos(windowPos.x - 192*2, windowPos.y)
    }
    if(isPressing && menuPosition === "right" && isTalkMenuOpen){
      changeWindowPos(windowPos.x + 192*2, windowPos.y)
    }
    if(isPressing && menuPosition === "left" && isContextMenuOpen){
      changeWindowPos(windowPos.x - 16*3*2, windowPos.y)
    }
    if(isPressing && menuPosition === "right" && isContextMenuOpen){
      changeWindowPos(windowPos.x + 16*3*2, windowPos.y)
    }
  },[menuPosition])

  return (
    // Use divs instead of main, or ensure main has no conflicting styles
    // Using relative positioning on the parent allows absolute positioning for children
    <div className="relative w-screen h-screen overflow-hidden"> {/* Ensure container fills window and hides overflow */}

      <div
        className={"preventSelect absolute w-[192px] h-[192px] bg-transparent select-none text-[0.5rem] top-0 text-center cursor-grab active:cursor-grabbing " + (charPosition==="left" ? "left-0":"right-0")} // Covers the area, transparent
        data-tauri-drag-region // The drag region
        onMouseDown={()=>{
          setIsPressing(true)
          setIsMoving(false)
          stop()
        }}
        onMouseUp={()=>{
          setIsPressing(false)
        }}
        onDoubleClick={()=>{
          setIsTalkMenuOpen(!isTalkMenuOpen)
        }}
        onContextMenu={(e)=>{
          e.preventDefault()
          setIsContextMenuOpen(!isContextMenuOpen)
        }}
      >
        x: {windowPos.x}, y: {windowPos.y}<br />
        screenW: {screenSize.width}, screenH: {screenSize.height}<br/>
        windowW: {windowPos.width}, windowH: {windowPos.height}
      </div>

      {/* Foreground: Holds content, allows events to pass through by default */}
      
        {currentStateData && (
          <div 
            className={
              "absolute top-0 " + 
              (charPosition === "left" ? "left-0" : "right-0") + 
              " w-[192px] h-[192px] select-none transition pointer-events-none duration-200 " + 
              (currentStateData.className || '')
            }
          >
            <img
              src={delayedImg} // Use the delayed image
              alt={currentStateData.state}
              className="w-full h-full select-none pointer-events-none object-contain"
            />
          </div>
        )}
        {/* menu */}
        <AnimatePresence mode="wait">
          {isTalkMenuOpen && (
            <motion.div 
              className={
                "absolute top-4 " + 
                (menuPosition === "left" ? "left-4" : "right-4")
              }
              initial={{ opacity: 0, y: 40, x: (menuPosition==="left" ? 40:-40) }}      // Start faded out and lower
              animate={{ opacity: 1, y: 0, x:0 }}       // Animate to visible and in place
              exit={{ opacity: 0, y: 40, x: (menuPosition==="left" ? 40:-40) }}         // Animate out the same way
              transition={{ duration: 0.2, type: "spring", bounce: 0.2 }} // Smooth springy transition
            >
              <Card 
                className="h-[192px] w-[192px] boxUI flex flex-col"
              >
                <div className="p-1">
                  <Button onClick={()=>{
                    setIsTalkMenuOpen(false)
                  }} className="w-6 h-6 p-1.5 flex justify-center items-center m-1 text-2xl" variant="inset"><img className="w-full h-full" src="close.png" alt="close"/></Button>
                </div>
                <div className="flex-1">

                </div>
                <div className="p-2 flex gap-3 text-">
                  <Input />
                  {/* <div className="flex items-center">
                    <Button className="w-6 h-6">⏎</Button>
                  </div> */}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">

          {isContextMenuOpen && (
            <motion.div 
              className={
                "absolute top-4 " + 
                (menuPosition === "left" ? "left-4" : "right-4")
              }
              initial={{ opacity: 0, x: (menuPosition==="left" ? 40:-40) }}      // Start faded out and lower
              animate={{ opacity: 1, x:0 }}       // Animate to visible and in place
              exit={{ opacity: 0, x: (menuPosition==="left" ? 40:-40) }}         // Animate out the same way
              transition={{ duration: 0.2, type: "spring", bounce: 0.2 }} // Smooth springy transition
            >
              <Button 
                className="w-8 h-8 p-1 flex justify-center items-center text-2xl"
                onClick={() => {
                  setTimeout(() => setIsTalkMenuOpen(true), 250)
                  setIsContextMenuOpen(false)
                }}
              >
                <img className="w-full h-full" src="chat.png" alt="chat"/>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
}
