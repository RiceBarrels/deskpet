import { motion } from "motion/react"

export default function Card({children, className="", variant="boxUI", ...props}){
    let variantClassName = "";
    if (variant == "inset") {
        variantClassName = "insetUI";
    } else if (variant == "outline") {
        variantClassName = "outlineUI hover:bg-foreground/50";
    } else if (variant == "shadowUI"){
        variantClassName = "shadowUI bg-background";
    } else if (variant == "ghost"){
        variantClassName = "ghostUI";
    } else if (variant == "boxUI"){
        variantClassName = "boxUI bg-background";
    }
    return (
        <motion.div className={
            variantClassName + 
            " " +
            className
        }>
            {children}
        </motion.div>
    )
}