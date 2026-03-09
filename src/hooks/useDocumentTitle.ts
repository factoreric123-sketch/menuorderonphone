import { useEffect } from "react";

export const useDocumentTitle = (title: string, description?: string) => {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} | MenuCraft` : "MenuCraft - Digital Menu Builder";
    
    if (description) {
      let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "description";
        document.head.appendChild(meta);
      }
      meta.content = description;
    }

    return () => { document.title = prev; };
  }, [title, description]);
};
