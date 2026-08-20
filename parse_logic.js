      const term = filterSearchTerm.toLowerCase();
      let maxPrice = Infinity;
      let minPrice = 0;
      let targetRooms = 0;
      let maxRooms = Infinity;
      let minRooms = 0;
      
      // Parse Prices (supports 2 מיליון, 2.5m, etc)
      const millionMatch = term.match(/(\d+(\.\d+)?)\s*(מיליון|m)/);
      if (millionMatch) {
        const val = parseFloat(millionMatch[1]) * 1000000;
        if (term.includes("עד") || term.includes("פחות")) maxPrice = val;
        else if (term.includes("מעל") || term.includes("יותר")) minPrice = val;
        else maxPrice = val;
      }
      
      const thousandMatch = term.match(/(\d+(\.\d+)?)\s*(אלף|k)/);
      if (thousandMatch && !millionMatch) {
        const val = parseFloat(thousandMatch[1]) * 1000;
        if (term.includes("עד") || term.includes("פחות")) maxPrice = val;
        else if (term.includes("מעל") || term.includes("יותר")) minPrice = val;
        else maxPrice = val;
      }

      // Rooms
      const roomMatch = term.match(/(\d+(\.\d+)?)\s*(חדר|חד')/);
      if (roomMatch) {
         const r = parseFloat(roomMatch[1]);
         if (term.includes("עד") || term.includes("פחות")) maxRooms = r;
         else if (term.includes("מעל") || term.includes("יותר")) minRooms = r;
         else targetRooms = r;
      }
      
      // Clean term from parsed math to leave just address
      const cleanTerm = term
        .replace(/(\d+(\.\d+)?)\s*(מיליון|m|אלף|k|חדר|חד')/g, "")
        .replace(/(עד|מעל|פחות|יותר|מ-|ב-)/g, "")
        .trim();

      list = list.filter((tx) => {
        let keep = true;
        if (maxPrice < Infinity && tx.price > maxPrice) keep = false;
        if (minPrice > 0 && tx.price < minPrice) keep = false;
        if (targetRooms > 0 && tx.rooms !== targetRooms) keep = false;
        if (maxRooms < Infinity && tx.rooms > maxRooms) keep = false;
        if (minRooms > 0 && tx.rooms < minRooms) keep = false;
        
        if (cleanTerm.length > 1) {
          if (!tx.address.toLowerCase().includes(cleanTerm)) keep = false;
        }
        return keep;
      });
