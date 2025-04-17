import { useState } from "react"

export default function Input({onEnter, ...props}){
    const [isEnterPressing, setIsEnterPressing] = useState(false)
    return(
        <input 
            onKeyDown={(e)=>{
                if(e.key === "Enter"){
                    setIsEnterPressing(true)
                    onEnter()
                }
            }}
            onKeyUp={(e)=>{
                if(e.key === "Enter"){
                    setIsEnterPressing(false)
                }
            }}
            className={"insetUI w-full px-1 mx-2 my-1 outline-0 text-inset " + (isEnterPressing ? "active" : "")}
            {...props}
        />
    )
}