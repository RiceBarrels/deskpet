export default function Button({children, className="", variant="shadow", ...props}){
    let variantClassName = "";
    if (variant == "inset") {
        variantClassName = "insetUI";
    } else if (variant == "outline") {
        variantClassName = "outlineUI hover:bg-foreground/50";
    } else if (variant == "shadow"){
        variantClassName = "shadowUI bg-background";
    } else if (variant == "ghost"){
        variantClassName = "hover:bg-foreground ghostUI";
    } else if (variant == "box"){
        variantClassName = "boxUI bg-background";
    }
    return (
        <button className={variantClassName+" cursor-pointer "+className} {...props}>{children}</button>
    )
}