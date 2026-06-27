import React, { useState, useEffect, useMemo, useRef } from "react";

/* ============================ DATA ============================ */
const SEED = [{"id":"h1","date":"2025-05-27","rpm":1.46,"rate":800.0,"miles":415,"broker":"CH Robinson","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":240.0,"dh":133,"status":"Delivered"},{"id":"h2","date":"2025-05-28","rpm":1.61,"rate":800.0,"miles":426,"broker":"D&L Transport","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":240.0,"dh":70,"status":"Delivered"},{"id":"h3","date":"2025-06-04","rpm":1.64,"rate":850.0,"miles":407,"broker":"NFL Logistics","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":255.0,"dh":110,"status":"Delivered"},{"id":"h4","date":"2025-06-06","rpm":1.32,"rate":350.0,"miles":265,"broker":"ILG Logistics","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":105.0,"dh":null,"status":"Delivered"},{"id":"h5","date":"2025-06-10","rpm":1.96,"rate":500.0,"miles":169,"broker":"Custom Logistics","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":150.0,"dh":86,"status":"Delivered"},{"id":"h6","date":"2025-06-24","rpm":1.76,"rate":500.0,"miles":139,"broker":"Total Transportation","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":150.0,"dh":145,"status":"Delivered"},{"id":"h7","date":"2025-06-26","rpm":2.7,"rate":1100.0,"miles":406,"broker":"Agforce Transport","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":330.0,"dh":null,"status":"Delivered"},{"id":"h8","date":"2025-07-01","rpm":2.0,"rate":400.0,"miles":200,"broker":"Centran Logistics","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":120.0,"dh":null,"status":"Delivered"},{"id":"h9","date":"2025-07-22","rpm":1.75,"rate":700.0,"miles":199,"broker":"CH Robinson","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":210.0,"dh":199,"status":"Delivered"},{"id":"h10","date":"2025-07-24","rpm":1.84,"rate":900.0,"miles":244,"broker":"BBL Transportation","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":270.0,"dh":244,"status":"Delivered"},{"id":"h11","date":"2025-07-29","rpm":1.26,"rate":700.0,"miles":276,"broker":"Cleveland Logistics","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":210.0,"dh":276,"status":"Delivered"},{"id":"h12","date":"2025-07-31","rpm":2.07,"rate":825.0,"miles":199,"broker":"APT Industries","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":247.5,"dh":199,"status":"Delivered"},{"id":"h13","date":"2025-08-06","rpm":2.07,"rate":825.0,"miles":199,"broker":"APT Industries","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":247.5,"dh":199,"status":"Delivered"},{"id":"h14","date":"2025-08-09","rpm":1.84,"rate":900.0,"miles":244,"broker":"BBL Transportation","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":270.0,"dh":244,"status":"Delivered"},{"id":"h15","date":"2025-08-18","rpm":2.07,"rate":825.0,"miles":199,"broker":"APT Industries","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":247.5,"dh":199,"status":"Delivered"},{"id":"h16","date":"2025-08-19","rpm":1.84,"rate":900.0,"miles":244,"broker":"BBL Transportation","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":270.0,"dh":244,"status":"Delivered"},{"id":"h17","date":"2025-08-26","rpm":3.25,"rate":322.5,"miles":30,"broker":"CH Robinson","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":96.75,"dh":70,"status":"Delivered"},{"id":"h18","date":"2025-09-02","rpm":1.91,"rate":1150.0,"miles":325,"broker":"BBL Transportation","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":345.0,"dh":276,"status":"Delivered"},{"id":"h19","date":"2025-09-08","rpm":2.07,"rate":825.0,"miles":199,"broker":"APT Industries","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":247.5,"dh":199,"status":"Delivered"},{"id":"h20","date":"2025-09-15","rpm":2.42,"rate":650.0,"miles":134,"broker":"CH Robinson","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":195.0,"dh":134,"status":"Delivered"},{"id":"h21","date":"2025-09-16","rpm":2.5,"rate":500.0,"miles":400,"broker":"CKM Trucks","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h22","date":"2025-09-23","rpm":1.33,"rate":1200.0,"miles":900,"broker":"CKM Trucks","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":360.0,"dh":null,"status":"Delivered"},{"id":"h23","date":"2025-09-30","rpm":1.06,"rate":1600.0,"miles":1500,"broker":"CKM Trucks","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":480.0,"dh":null,"status":"Delivered"},{"id":"h24","date":"2025-10-06","rpm":1.33,"rate":400.0,"miles":300,"broker":"CKM Trucks","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":120.0,"dh":null,"status":"Delivered"},{"id":"h25","date":"2025-10-07","rpm":1.25,"rate":500.0,"miles":400,"broker":"CKM Trucks","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h26","date":"2025-10-14","rpm":1.66,"rate":500.0,"miles":300,"broker":"LEG Freight Solutions","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h27","date":"2025-10-30","rpm":1.64,"rate":700.0,"miles":426,"broker":"Middle Sis Inc","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":210.0,"dh":null,"status":"Delivered"},{"id":"h28","date":"2025-11-02","rpm":2.11,"rate":900.0,"miles":426,"broker":"Flock Freight","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":270.0,"dh":null,"status":"Delivered"},{"id":"h29","date":"2025-11-03","rpm":1.86,"rate":700.0,"miles":375,"broker":"Trupoint Logistics","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":210.0,"dh":null,"status":"Delivered"},{"id":"h30","date":"2025-11-04","rpm":2.09,"rate":1300.0,"miles":620,"broker":"WSI Freight","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":390.0,"dh":null,"status":"Delivered"},{"id":"h31","date":"2025-11-05","rpm":1.69,"rate":700.0,"miles":412,"broker":"C Cross Logistics","driver":"Derek","unit":"","pay":1375.0,"fuel":1074.0,"repair":null,"dispatch":210.0,"dh":null,"status":"Delivered"},{"id":"h32","date":"2025-11-11","rpm":1.85,"rate":900.0,"miles":486,"broker":"CH Robinson","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":270.0,"dh":null,"status":"Delivered"},{"id":"h33","date":"2025-11-12","rpm":37.5,"rate":150.0,"miles":4,"broker":"Destination Transport","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":45.0,"dh":null,"status":"Delivered"},{"id":"h34","date":"2025-11-13","rpm":1.08,"rate":450.0,"miles":486,"broker":"CH Robinson","driver":"Derek","unit":"","pay":716.0,"fuel":400.0,"repair":null,"dispatch":135.0,"dh":null,"status":"Delivered"},{"id":"h35","date":"2025-11-24","rpm":2.25,"rate":1550.0,"miles":686,"broker":"HD Shipping","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":465.0,"dh":null,"status":"Delivered"},{"id":"h36","date":"2025-11-25","rpm":1.97,"rate":2000.0,"miles":1011,"broker":"HD Shipping","driver":"Derek","unit":"","pay":969.0,"fuel":707.0,"repair":null,"dispatch":600.0,"dh":null,"status":"Delivered"},{"id":"h37","date":"2025-12-01","rpm":1.99,"rate":750.0,"miles":376,"broker":"Flock Freight","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":225.0,"dh":null,"status":"Delivered"},{"id":"h38","date":"2025-12-02","rpm":1.84,"rate":1200.0,"miles":582,"broker":"Spot Freight","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":360.0,"dh":60,"status":"Delivered"},{"id":"h39","date":"2025-12-03","rpm":1.31,"rate":900.0,"miles":437,"broker":"CH Robinson","driver":"Derek","unit":"","pay":1200.0,"fuel":1214.0,"repair":null,"dispatch":270.0,"dh":245,"status":"Delivered"},{"id":"h40","date":"2025-12-16","rpm":1.8,"rate":450.0,"miles":125,"broker":"APT Industries","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":135.0,"dh":125,"status":"Delivered"},{"id":"h41","date":"2025-12-17","rpm":1.19,"rate":400.0,"miles":168,"broker":"RTS","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":120.0,"dh":168,"status":"Delivered"},{"id":"h42","date":"2025-12-18","rpm":2.32,"rate":1400.0,"miles":461,"broker":"MegaCorp","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":420.0,"dh":141,"status":"Delivered"},{"id":"h43","date":"2025-12-19","rpm":0.5,"rate":300.0,"miles":600,"broker":"Allen Lund Company","driver":"Derek","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":90.0,"dh":null,"status":"Delivered"},{"id":"h44","date":"2026-01-02","rpm":1.62,"rate":1250.0,"miles":770,"broker":"Summitt Logistics","driver":"TJ","unit":"2","pay":424.0,"fuel":319.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h45","date":"2026-01-06","rpm":1.62,"rate":750.0,"miles":461,"broker":"MegaCorp","driver":"TJ","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h46","date":"2026-01-08","rpm":1.6,"rate":1500.0,"miles":936,"broker":"FreightFlex","driver":"TJ","unit":"2","pay":781.0,"fuel":576.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h47","date":"2026-01-12","rpm":2.72,"rate":1500.0,"miles":550,"broker":"FreightFlex","driver":"TJ","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h48","date":"2026-01-13","rpm":3.8,"rate":950.0,"miles":250,"broker":"Ryan Transportation","driver":"TJ","unit":"2","pay":830.0,"fuel":600.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h49","date":"2026-01-14","rpm":1.76,"rate":1250.0,"miles":710,"broker":"TA Services","driver":"TJ","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h50","date":"2026-01-20","rpm":1.72,"rate":1754.0,"miles":1018,"broker":"Norfleet Logistics","driver":"TJ","unit":"2","pay":899.0,"fuel":750.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h51","date":"2026-01-22","rpm":1.55,"rate":961.0,"miles":618,"broker":"Norfleet Logistics","driver":"TJ","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h52","date":"2026-01-26","rpm":1.1,"rate":725.0,"miles":656,"broker":"Norfleet Logistics","driver":"TJ","unit":"2","pay":380.0,"fuel":300.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h53","date":"2026-01-28","rpm":1.84,"rate":1643.0,"miles":894,"broker":"Norfleet Logistics","driver":"John","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h54","date":"2026-01-29","rpm":2.0,"rate":725.0,"miles":336,"broker":"Norfleet Logistics","driver":"John","unit":"1","pay":650.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h55","date":"2026-01-29","rpm":1.84,"rate":1589.25,"miles":860,"broker":"Norfleet Logistics","driver":"Chris","unit":"2","pay":780.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h56","date":"2026-02-04","rpm":4.29,"rate":1800.0,"miles":419,"broker":"Sage Freight","driver":"Chris","unit":"2","pay":262.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h57","date":"2026-02-04","rpm":4.29,"rate":1800.0,"miles":419,"broker":"Sage Freight","driver":"John","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h58","date":"2026-02-04","rpm":4.29,"rate":1800.0,"miles":419,"broker":"Sage Freight","driver":"TJ","unit":"4","pay":525.0,"fuel":500.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h59","date":"2026-02-05","rpm":2.58,"rate":1800.0,"miles":695,"broker":"TQL","driver":"Chris","unit":"2","pay":450.0,"fuel":550.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h60","date":"2026-02-05","rpm":2.21,"rate":900.0,"miles":406,"broker":"NT Logistics","driver":"TJ","unit":"4","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h61","date":"2026-02-05","rpm":2.21,"rate":900.0,"miles":406,"broker":"NT Logistics","driver":"John","unit":"3","pay":500.0,"fuel":450.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h62","date":"2026-02-06","rpm":1.85,"rate":2372.0,"miles":1280,"broker":"Norfleet Logistics","driver":"John","unit":"3","pay":768.0,"fuel":798.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h63","date":"2026-02-06","rpm":1.8,"rate":2700.0,"miles":1500,"broker":"Green Logistics LLC","driver":"Chris","unit":"2","pay":906.0,"fuel":700.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h64","date":"2026-02-09","rpm":1.66,"rate":1059.0,"miles":637,"broker":"Norfleet Logistics","driver":"John","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h65","date":"2026-02-10","rpm":2.0,"rate":2000.0,"miles":1000,"broker":"TQL","driver":"Chris","unit":"2","pay":630.0,"fuel":719.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h66","date":"2026-02-11","rpm":2.02,"rate":2163.0,"miles":1069,"broker":"Norfleet Logistics","driver":"John","unit":"3","pay":1023.0,"fuel":542.5,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h67","date":"2026-02-11","rpm":1.75,"rate":1526.0,"miles":870,"broker":"Norfleet Logistics","driver":"TJ","unit":"4","pay":478.5,"fuel":500.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h68","date":"2026-02-12","rpm":2.88,"rate":1350.0,"miles":468,"broker":"TQL","driver":"Chris","unit":"2","pay":294.0,"fuel":272.29,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h69","date":"2026-02-12","rpm":2.03,"rate":1435.0,"miles":705,"broker":"Norfleet Logistics","driver":"TJ","unit":"4","pay":475.55,"fuel":550.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h70","date":"2026-02-16","rpm":4.25,"rate":3400.0,"miles":800,"broker":"TQL","driver":"John","unit":"3","pay":605.0,"fuel":413.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h71","date":"2026-02-18","rpm":2.69,"rate":2000.0,"miles":743,"broker":"TQL","driver":"John","unit":"3","pay":550.0,"fuel":400.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h72","date":"2026-02-18","rpm":1.54,"rate":2200.0,"miles":713,"broker":"TQL","driver":"TJ","unit":"4","pay":838.0,"fuel":1050.0,"repair":300.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h73","date":"2026-02-19","rpm":2.6,"rate":1200.0,"miles":615,"broker":"SPI Logistics","driver":"TJ","unit":"4","pay":340.0,"fuel":378.0,"repair":300.0,"dispatch":80.0,"dh":null,"status":"Delivered"},{"id":"h74","date":"2026-02-23","rpm":2.6,"rate":1150.0,"miles":441,"broker":"Trident Logistics","driver":"John","unit":"3","pay":200.0,"fuel":260.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h75","date":"2026-02-23","rpm":2.7,"rate":1350.0,"miles":499,"broker":"TQL","driver":"John","unit":"3","pay":612.0,"fuel":200.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h76","date":"2026-02-23","rpm":2.22,"rate":1000.0,"miles":450,"broker":"White Acre Logistics","driver":"TJ","unit":"4","pay":null,"fuel":250.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h77","date":"2026-02-23","rpm":1.53,"rate":2200.0,"miles":1430,"broker":"TQL","driver":"Chris","unit":"2","pay":340.0,"fuel":256.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h78","date":"2026-02-24","rpm":3.75,"rate":1500.0,"miles":400,"broker":"Pivot Supply","driver":"TJ","unit":"4","pay":null,"fuel":330.9,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h79","date":"2026-02-25","rpm":2.44,"rate":1050.0,"miles":430,"broker":"PVG Brokerage","driver":"TJ","unit":"4","pay":724.0,"fuel":200.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h80","date":"2026-02-25","rpm":1.88,"rate":900.0,"miles":460,"broker":"RTS","driver":"John","unit":"3","pay":180.0,"fuel":480.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h81","date":"2026-02-26","rpm":3.36,"rate":1050.0,"miles":312,"broker":"PVG Brokerage","driver":"Chris","unit":"2","pay":200.0,"fuel":309.42,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h82","date":"2026-02-26","rpm":2.8,"rate":1950.0,"miles":695,"broker":"Trinity Logistics","driver":"John","unit":"3","pay":null,"fuel":349.17,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h83","date":"2026-02-27","rpm":2.3,"rate":1500.0,"miles":650,"broker":"Texas Customer","driver":"John","unit":"3","pay":807.0,"fuel":200.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h84","date":"2026-02-27","rpm":2.81,"rate":1800.0,"miles":615,"broker":"Lipsey Logistics","driver":"Chris","unit":"2","pay":390.0,"fuel":220.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h85","date":"2026-03-01","rpm":2.5,"rate":1400.0,"miles":559,"broker":"TQL","driver":"John","unit":"3","pay":335.4,"fuel":443.6,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h86","date":"2026-03-02","rpm":2.9,"rate":1900.0,"miles":653,"broker":"Barnhart Logistics","driver":"John","unit":"3","pay":391.8,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h87","date":"2026-03-02","rpm":2.63,"rate":1250.0,"miles":475,"broker":"PVG Brokerage","driver":"Chris","unit":"2","pay":300.0,"fuel":370.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h88","date":"2026-03-02","rpm":2.95,"rate":1250.0,"miles":423,"broker":"PVG Brokerage","driver":"TJ","unit":"4","pay":null,"fuel":292.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h89","date":"2026-03-03","rpm":1.82,"rate":1500.0,"miles":824,"broker":"TQL","driver":"TJ","unit":"2","pay":750.0,"fuel":302.54,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h90","date":"2026-03-03","rpm":1.82,"rate":1500.0,"miles":824,"broker":"TQL","driver":"Chris","unit":"2","pay":494.0,"fuel":437.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h91","date":"2026-03-03","rpm":2.39,"rate":1100.0,"miles":460,"broker":"Uber Freight","driver":"John","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h92","date":"2026-03-03","rpm":2.82,"rate":1300.0,"miles":null,"broker":"D&L Transport","driver":"John","unit":"3","pay":400.0,"fuel":719.74,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h93","date":"2026-03-04","rpm":2.44,"rate":1200.0,"miles":490,"broker":"Value Logistics","driver":"John","unit":"3","pay":294.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h94","date":"2026-03-04","rpm":2.5,"rate":3000.0,"miles":1424,"broker":"TQL","driver":"TJ","unit":"4","pay":980.0,"fuel":1300.0,"repair":595.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h95","date":"2026-03-04","rpm":2.37,"rate":2500.0,"miles":1053,"broker":"Universal Logistics","driver":"Chris","unit":"2","pay":631.8,"fuel":721.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h96","date":"2026-03-06","rpm":2.1,"rate":3750.0,"miles":1781,"broker":"Jones Transport","driver":"John","unit":"3","pay":1068.0,"fuel":922.0,"repair":2000.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h97","date":"2026-03-06","rpm":2.34,"rate":2500.0,"miles":1060,"broker":"Nationwide Transport","driver":"Chris","unit":"2","pay":250.0,"fuel":324.57,"repair":900.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h98","date":"2026-03-09","rpm":1.62,"rate":700.0,"miles":430,"broker":"Ark Logistics","driver":"John","unit":"3","pay":258.0,"fuel":511.0,"repair":2000.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h99","date":"2026-03-10","rpm":2.76,"rate":1700.0,"miles":615,"broker":"Trinity Logistics","driver":"Chris","unit":"2","pay":569.0,"fuel":600.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h100","date":"2026-03-12","rpm":2.66,"rate":1600.0,"miles":555,"broker":"Heniff Logistics","driver":"Chris","unit":"2","pay":333.0,"fuel":936.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h101","date":"2026-03-13","rpm":3.39,"rate":1750.0,"miles":515,"broker":"ITS Logistics","driver":"Chris","unit":"2","pay":323.0,"fuel":490.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h102","date":"2026-03-16","rpm":2.11,"rate":1050.0,"miles":496,"broker":"PVG Brokerage","driver":"Chris","unit":"2","pay":300.0,"fuel":257.01,"repair":195.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h103","date":"2026-03-17","rpm":2.36,"rate":1700.0,"miles":720,"broker":"Tri-State Logistics","driver":"Chris","unit":"2","pay":432.0,"fuel":540.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h104","date":"2026-03-18","rpm":2.08,"rate":1000.0,"miles":479,"broker":"Trident Transport","driver":"Chris","unit":"2","pay":287.0,"fuel":334.0,"repair":40.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h105","date":"2026-03-18","rpm":2.08,"rate":1500.0,"miles":720,"broker":"Tri-State Logistics","driver":"TJ","unit":"4","pay":null,"fuel":420.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h106","date":"2026-03-18","rpm":2.22,"rate":1600.0,"miles":720,"broker":"Tri-State Logistics","driver":"John","unit":"3","pay":435.0,"fuel":466.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h107","date":"2026-03-19","rpm":3.66,"rate":2200.0,"miles":600,"broker":"Pepsi Co","driver":"Chris","unit":"2","pay":360.0,"fuel":650.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h108","date":"2026-03-20","rpm":2.4,"rate":2500.0,"miles":1040,"broker":"TQL","driver":"John","unit":"3","pay":630.0,"fuel":490.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h109","date":"2026-03-20","rpm":2.38,"rate":1000.0,"miles":420,"broker":"Cargo Solution","driver":"TJ","unit":"4","pay":629.75,"fuel":360.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h110","date":"2026-03-23","rpm":2.99,"rate":1400.0,"miles":468,"broker":"Onewaytrailers","driver":"John","unit":"3","pay":280.0,"fuel":387.14,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h111","date":"2026-03-23","rpm":2.37,"rate":1500.0,"miles":631,"broker":"Armstrong Transport","driver":"Chris","unit":"2","pay":425.0,"fuel":690.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h112","date":"2026-03-24","rpm":2.27,"rate":3300.0,"miles":1450,"broker":"Ten Logistics","driver":"Chris","unit":"2","pay":916.0,"fuel":1392.0,"repair":20.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h113","date":"2026-03-25","rpm":2.51,"rate":4000.0,"miles":1590,"broker":"Navajo Transport","driver":"John","unit":"3","pay":960.0,"fuel":1038.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h114","date":"2026-03-25","rpm":3.04,"rate":1600.0,"miles":525,"broker":"TQL","driver":"TJ","unit":"4","pay":null,"fuel":560.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h115","date":"2026-03-25","rpm":2.8,"rate":1400.0,"miles":500,"broker":"TQL","driver":"TJ","unit":"4","pay":275.0,"fuel":850.0,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h116","date":"2026-03-27","rpm":2.42,"rate":1700.0,"miles":700,"broker":"TQL","driver":"Jeremy","unit":"5","pay":320.0,"fuel":800.0,"repair":null,"dispatch":125.0,"dh":null,"status":"Delivered"},{"id":"h117","date":"2026-03-29","rpm":2.61,"rate":2750.0,"miles":1050,"broker":"TQL","driver":"Jeremy","unit":"5","pay":630.0,"fuel":950.0,"repair":null,"dispatch":140.0,"dh":null,"status":"Delivered"},{"id":"h118","date":"2026-03-30","rpm":2.1,"rate":1400.0,"miles":664,"broker":"C Cross Logistics","driver":"TJ","unit":"4","pay":null,"fuel":484.4,"repair":null,"dispatch":70.0,"dh":null,"status":"Delivered"},{"id":"h119","date":"2026-03-30","rpm":2.0,"rate":1000.0,"miles":480,"broker":"Visual Pak Logistics","driver":"John","unit":"3","pay":300.0,"fuel":660.0,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h120","date":"2026-03-31","rpm":2.48,"rate":3700.0,"miles":1490,"broker":"Confiance Logistics","driver":"Jeremy","unit":"5","pay":894.0,"fuel":1500.0,"repair":null,"dispatch":150.0,"dh":null,"status":"Delivered"},{"id":"h121","date":"2026-03-31","rpm":3.43,"rate":2750.0,"miles":800,"broker":"TQL","driver":"TJ","unit":"4","pay":null,"fuel":700.0,"repair":null,"dispatch":100.0,"dh":null,"status":"Delivered"},{"id":"h122","date":"2026-04-01","rpm":2.36,"rate":1250.0,"miles":528,"broker":"White Acre Logistics","driver":"TJ","unit":"4","pay":1100.0,"fuel":760.0,"repair":null,"dispatch":60.0,"dh":null,"status":"Delivered"},{"id":"h123","date":"2026-04-02","rpm":2.71,"rate":1200.0,"miles":442,"broker":"RXO Logistics","driver":"Jeremy","unit":"5","pay":319.24,"fuel":504.6,"repair":null,"dispatch":60.0,"dh":null,"status":"Delivered"},{"id":"h124","date":"2026-04-02","rpm":2.37,"rate":950.0,"miles":400,"broker":"PVG Brokerage","driver":"John","unit":"3","pay":240.0,"fuel":466.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h125","date":"2026-04-03","rpm":2.37,"rate":950.0,"miles":400,"broker":"PVG Brokerage","driver":"John","unit":"3","pay":240.0,"fuel":545.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h126","date":"2026-04-03","rpm":2.75,"rate":1100.0,"miles":400,"broker":"PVG Brokerage","driver":"Jeremy","unit":"5","pay":null,"fuel":452.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h127","date":"2026-04-04","rpm":2.75,"rate":1100.0,"miles":400,"broker":"PVG Brokerage","driver":"Jeremy","unit":"5","pay":480.0,"fuel":125.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h128","date":"2026-04-04","rpm":2.37,"rate":950.0,"miles":400,"broker":"PVG Brokerage","driver":"John","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h129","date":"2026-04-05","rpm":2.37,"rate":950.0,"miles":400,"broker":"PVG Brokerage","driver":"John","unit":"3","pay":480.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h130","date":"2026-04-06","rpm":2.53,"rate":3300.0,"miles":1300,"broker":"TQL","driver":"Jeremy","unit":"5","pay":780.0,"fuel":1100.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h131","date":"2026-04-08","rpm":2.27,"rate":1550.0,"miles":680,"broker":"TQL","driver":"Jeremy","unit":"5","pay":360.0,"fuel":653.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h132","date":"2026-04-10","rpm":1.86,"rate":1050.0,"miles":563,"broker":"Bee Mac Logistics","driver":"Jeremy","unit":"5","pay":330.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h133","date":"2026-04-13","rpm":2.78,"rate":2300.0,"miles":825,"broker":"Dedicated Logistics","driver":"Jeremy","unit":"5","pay":495.0,"fuel":424.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h134","date":"2026-04-14","rpm":4.4,"rate":3347.0,"miles":759,"broker":"Sage Freight","driver":"Jeremy","unit":"5","pay":400.0,"fuel":1110.0,"repair":null,"dispatch":200.0,"dh":null,"status":"Delivered"},{"id":"h135","date":"2026-04-14","rpm":2.54,"rate":1525.0,"miles":600,"broker":"Direct Connect","driver":"TJ","unit":"3","pay":1186.0,"fuel":849.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h136","date":"2026-04-15","rpm":2.8,"rate":2100.0,"miles":750,"broker":"TQL","driver":"TJ","unit":"3","pay":null,"fuel":80.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h137","date":"2026-04-16","rpm":2.53,"rate":3300.0,"miles":1300,"broker":"TQL","driver":"John","unit":"2","pay":840.0,"fuel":941.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h138","date":"2026-04-17","rpm":2.37,"rate":1400.0,"miles":589,"broker":"Priority","driver":"TJ","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h139","date":"2026-04-17","rpm":3.25,"rate":1300.0,"miles":400,"broker":"Forward Air","driver":"Jeremy","unit":"5","pay":null,"fuel":596.85,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h140","date":"2026-04-18","rpm":2.84,"rate":2150.0,"miles":820,"broker":"Direct Connect","driver":"Jeremy","unit":"5","pay":341.0,"fuel":570.0,"repair":null,"dispatch":750.0,"dh":null,"status":"Delivered"},{"id":"h141","date":"2026-04-20","rpm":3.25,"rate":1625.0,"miles":500,"broker":"American Diamond","driver":"John","unit":"2","pay":340.0,"fuel":450.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h142","date":"2026-04-20","rpm":2.89,"rate":2000.0,"miles":690,"broker":"Listo Services","driver":"Jeremy","unit":"5","pay":345.0,"fuel":420.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h143","date":"2026-04-21","rpm":2.5,"rate":2000.0,"miles":800,"broker":"MegaCorp","driver":"Jeremy","unit":"5","pay":480.0,"fuel":400.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h144","date":"2026-04-21","rpm":null,"rate":1200.0,"miles":null,"broker":"","driver":"John","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h145","date":"2026-04-21","rpm":4.57,"rate":1900.0,"miles":678,"broker":"Ryan Transportation","driver":"John","unit":"2","pay":null,"fuel":483.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h146","date":"2026-04-22","rpm":2.75,"rate":1100.0,"miles":400,"broker":"PVG Brokerage","driver":"TJ","unit":"3","pay":220.0,"fuel":310.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h147","date":"2026-04-26","rpm":2.78,"rate":2300.0,"miles":825,"broker":"Dedicated Logistics","driver":"John","unit":"2","pay":425.0,"fuel":560.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h148","date":"2026-04-26","rpm":3.75,"rate":300.0,"miles":80,"broker":"PVG Brokerage","driver":"TJ","unit":"3","pay":175.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h149","date":"2026-04-27","rpm":2.77,"rate":500.0,"miles":180,"broker":"Infinity Logistics","driver":"TJ","unit":"3","pay":100.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h150","date":"2026-04-28","rpm":3.26,"rate":1000.0,"miles":306,"broker":"PVG Brokerage","driver":"TJ","unit":"3","pay":200.0,"fuel":290.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h151","date":"2026-04-28","rpm":3.11,"rate":2700.0,"miles":850,"broker":"RXO Logistics","driver":"John","unit":"2","pay":null,"fuel":1110.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h152","date":"2026-04-28","rpm":2.95,"rate":1300.0,"miles":440,"broker":"Value Logistics","driver":"Jeremy","unit":"5","pay":null,"fuel":1050.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h153","date":"2026-04-29","rpm":2.58,"rate":3100.0,"miles":1200,"broker":"Blue Fawney Logistics","driver":"Jeremy","unit":"5","pay":null,"fuel":600.0,"repair":null,"dispatch":600.0,"dh":null,"status":"Delivered"},{"id":"h154","date":"2026-04-30","rpm":4.52,"rate":1300.0,"miles":552,"broker":"DHL","driver":"John","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h155","date":"2026-04-30","rpm":null,"rate":1200.0,"miles":null,"broker":"Trinity Logistics","driver":"John","unit":"2","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h156","date":"2026-05-01","rpm":2.6,"rate":1300.0,"miles":500,"broker":"DHL","driver":"Jeremy","unit":"5","pay":300.0,"fuel":620.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h157","date":"2026-05-02","rpm":2.37,"rate":1450.0,"miles":611,"broker":"ARL Logistics","driver":"Jeremy","unit":"5","pay":320.0,"fuel":800.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h158","date":"2026-05-03","rpm":4.04,"rate":2000.0,"miles":494,"broker":"Armstrong Transport","driver":"John","unit":"2","pay":343.0,"fuel":761.5,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h159","date":"2026-05-03","rpm":3.05,"rate":2200.0,"miles":null,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":432.0,"fuel":463.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h160","date":"2026-05-04","rpm":4.8,"rate":1300.0,"miles":500,"broker":"DHL","driver":"TJ","unit":"3","pay":null,"fuel":430.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h161","date":"2026-05-04","rpm":null,"rate":1100.0,"miles":null,"broker":"TA Services","driver":"","unit":"","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h162","date":"2026-05-05","rpm":3.6,"rate":2200.0,"miles":610,"broker":"Spot Freight","driver":"John","unit":"2","pay":490.0,"fuel":469.0,"repair":567.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h163","date":"2026-05-06","rpm":4.0,"rate":2000.0,"miles":500,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":660.0,"fuel":410.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h164","date":"2026-05-06","rpm":3.0,"rate":1800.0,"miles":600,"broker":"NFI Logistics","driver":"Jeremy","unit":"5","pay":365.0,"fuel":610.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h165","date":"2026-05-07","rpm":4.0,"rate":2000.0,"miles":494,"broker":"Armstrong Transport","driver":"John","unit":"2","pay":325.0,"fuel":470.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h166","date":"2026-05-07","rpm":3.44,"rate":2000.0,"miles":580,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":360.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h167","date":"2026-05-08","rpm":2.77,"rate":1450.0,"miles":522,"broker":"Destination Transport","driver":"Jeremy","unit":"5","pay":320.0,"fuel":468.0,"repair":null,"dispatch":950.0,"dh":null,"status":"Delivered"},{"id":"h168","date":"2026-05-09","rpm":3.05,"rate":2200.0,"miles":720,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":420.0,"fuel":227.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h169","date":"2026-05-11","rpm":2.53,"rate":1350.0,"miles":533,"broker":"Fox Logistics","driver":"TJ","unit":"3","pay":null,"fuel":548.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h170","date":"2026-05-11","rpm":2.5,"rate":1500.0,"miles":600,"broker":"TA Services","driver":"Jeremy","unit":"5","pay":360.0,"fuel":538.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h171","date":"2026-05-11","rpm":3.0,"rate":1800.0,"miles":600,"broker":"NFI Logistics","driver":"John","unit":"2","pay":360.0,"fuel":561.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h172","date":"2026-05-13","rpm":3.2,"rate":1700.0,"miles":530,"broker":"Midlink Logistics","driver":"TJ","unit":"3","pay":750.0,"fuel":520.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h173","date":"2026-05-15","rpm":4.33,"rate":1300.0,"miles":300,"broker":"Candor Expedite","driver":"Jeremy","unit":"5","pay":125.0,"fuel":530.0,"repair":1100.0,"dispatch":550.0,"dh":null,"status":"Delivered"},{"id":"h174","date":"2026-05-16","rpm":3.01,"rate":1650.0,"miles":548,"broker":"Rite Way Transport","driver":"John","unit":"2","pay":325.0,"fuel":426.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h175","date":"2026-05-16","rpm":3.1,"rate":1700.0,"miles":548,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":340.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h176","date":"2026-05-18","rpm":2.8,"rate":1100.0,"miles":392,"broker":"TA Services","driver":"John","unit":"2","pay":235.0,"fuel":428.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h177","date":"2026-05-18","rpm":2.42,"rate":1550.0,"miles":642,"broker":"Priority1","driver":"Jeremy","unit":"5","pay":385.0,"fuel":412.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h178","date":"2026-05-19","rpm":5.17,"rate":2000.0,"miles":811,"broker":"DHL","driver":"TJ","unit":"3","pay":null,"fuel":920.0,"repair":700.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h179","date":"2026-05-19","rpm":null,"rate":2200.0,"miles":null,"broker":"England Logistics","driver":"TJ","unit":"3","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h180","date":"2026-05-19","rpm":3.25,"rate":1200.0,"miles":369,"broker":"UACL Logistics","driver":"John","unit":"2","pay":370.0,"fuel":721.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h181","date":"2026-05-19","rpm":3.08,"rate":2000.0,"miles":649,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":395.0,"fuel":558.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h182","date":"2026-05-21","rpm":2.58,"rate":2000.0,"miles":775,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":1045.0,"fuel":400.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h183","date":"2026-05-22","rpm":3.0,"rate":1800.0,"miles":600,"broker":"NFI Logistics","driver":"Jeremy","unit":"5","pay":430.0,"fuel":685.0,"repair":null,"dispatch":700.0,"dh":null,"status":"Delivered"},{"id":"h184","date":"2026-05-23","rpm":3.36,"rate":1600.0,"miles":476,"broker":"TQL","driver":"Jeremy","unit":"5","pay":null,"fuel":465.0,"repair":250.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h185","date":"2026-05-25","rpm":2.69,"rate":2697.0,"miles":1000,"broker":"Circle Logistics","driver":"TJ","unit":"3","pay":null,"fuel":792.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h186","date":"2026-05-25","rpm":3.65,"rate":1800.0,"miles":493,"broker":"MegaCorp","driver":"Jeremy","unit":"5","pay":200.0,"fuel":465.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h187","date":"2026-05-26","rpm":2.71,"rate":1700.0,"miles":627,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":null,"fuel":638.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h188","date":"2026-05-26","rpm":2.91,"rate":1700.0,"miles":584,"broker":"BBI Logistics","driver":"Jeremy","unit":"5","pay":450.0,"fuel":364.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h189","date":"2026-05-27","rpm":3.96,"rate":2500.0,"miles":620,"broker":"Longship","driver":"Jeremy","unit":"5","pay":540.0,"fuel":467.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h190","date":"2026-05-27","rpm":2.29,"rate":1500.0,"miles":655,"broker":"Freight Management","driver":"TJ","unit":"3","pay":null,"fuel":260.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h191","date":"2026-05-28","rpm":3.03,"rate":2000.0,"miles":660,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":1760.0,"fuel":780.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h192","date":"2026-05-29","rpm":2.38,"rate":2300.0,"miles":964,"broker":"Pam Transport","driver":"John","unit":"","pay":570.0,"fuel":200.0,"repair":null,"dispatch":850.0,"dh":null,"status":"Delivered"},{"id":"h193","date":"2026-05-29","rpm":3.26,"rate":2000.0,"miles":612,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":735.0,"fuel":367.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h194","date":"2026-05-30","rpm":3.72,"rate":1980.0,"miles":532,"broker":"Steam Logistics","driver":"TJ","unit":"3","pay":null,"fuel":426.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h195","date":"2026-05-31","rpm":3.43,"rate":2400.0,"miles":698,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":738.0,"fuel":715.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h196","date":"2026-06-01","rpm":2.96,"rate":2000.0,"miles":675,"broker":"Central Freight","driver":"Jeremy","unit":"5","pay":410.0,"fuel":715.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h197","date":"2026-06-01","rpm":4.42,"rate":2500.0,"miles":565,"broker":"TQL","driver":"John","unit":"","pay":null,"fuel":400.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h198","date":"2026-06-02","rpm":2.77,"rate":1000.0,"miles":360,"broker":"PVG Brokerage","driver":"John","unit":"","pay":555.0,"fuel":900.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h199","date":"2026-06-02","rpm":null,"rate":2400.0,"miles":null,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":null,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h200","date":"2026-06-03","rpm":7.04,"rate":2600.0,"miles":710,"broker":"Central Freight","driver":"Jeremy","unit":"5","pay":450.0,"fuel":980.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h201","date":"2026-06-04","rpm":3.44,"rate":2100.0,"miles":610,"broker":"Online Freight","driver":"TJ","unit":"3","pay":null,"fuel":500.0,"repair":null,"dispatch":900.0,"dh":null,"status":"Delivered"},{"id":"h202","date":"2026-06-06","rpm":3.42,"rate":2400.0,"miles":700,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":810.0,"fuel":348.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h203","date":"2026-06-09","rpm":2.66,"rate":2050.0,"miles":770,"broker":"Integrity Logistics","driver":"TJ","unit":"3","pay":null,"fuel":740.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h204","date":"2026-06-11","rpm":2.3,"rate":1500.0,"miles":650,"broker":"TQL","driver":"TJ","unit":"3","pay":852.0,"fuel":651.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h205","date":"2026-06-11","rpm":2.7,"rate":1000.0,"miles":370,"broker":"TQL","driver":"Jeremy","unit":"5","pay":250.0,"fuel":470.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h206","date":"2026-06-12","rpm":3.24,"rate":1200.0,"miles":380,"broker":"Spot Freight","driver":"Jeremy","unit":"5","pay":260.0,"fuel":455.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h207","date":"2026-06-12","rpm":3.09,"rate":1500.0,"miles":484,"broker":"Armstrong Transport","driver":"TJ","unit":"3","pay":null,"fuel":372.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h208","date":"2026-06-13","rpm":2.72,"rate":1700.0,"miles":623,"broker":"TQL","driver":"Jeremy","unit":"5","pay":380.0,"fuel":null,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h209","date":"2026-06-13","rpm":3.26,"rate":1500.0,"miles":460,"broker":"TQL","driver":"TJ","unit":"3","pay":567.0,"fuel":210.0,"repair":null,"dispatch":450.0,"dh":null,"status":"Delivered"},{"id":"h210","date":"2026-06-15","rpm":2.4,"rate":1800.0,"miles":750,"broker":"TAB","driver":"Jeremy","unit":"5","pay":475.0,"fuel":544.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h211","date":"2026-06-16","rpm":2.88,"rate":1875.0,"miles":650,"broker":"Around The Clock","driver":"TJ","unit":"4","pay":null,"fuel":700.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h212","date":"2026-06-16","rpm":3.75,"rate":1800.0,"miles":480,"broker":"Armstrong Transport","driver":"Jeremy","unit":"5","pay":295.0,"fuel":420.91,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h213","date":"2026-06-17","rpm":3.35,"rate":1850.0,"miles":552,"broker":"SPI Logistics","driver":"Jeremy","unit":"5","pay":330.0,"fuel":620.0,"repair":895.0,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h214","date":"2026-06-17","rpm":2.0,"rate":1300.0,"miles":650,"broker":"Armstrong Transport","driver":"TJ","unit":"4","pay":130.0,"fuel":130.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"},{"id":"h215","date":"2026-06-19","rpm":null,"rate":1500.0,"miles":500,"broker":"TQL","driver":"TJ","unit":"4","pay":null,"fuel":750.0,"repair":null,"dispatch":null,"dh":null,"status":"Delivered"}];

/* ============================ TOKENS ============================ */
const C = {
  bg:"#0E1116", panel:"#161B22", panel2:"#1C222B", raised:"#222933",
  line:"#2A323D", lineSoft:"#222932",
  ink:"#E9ECF1", dim:"#8B95A3", faint:"#5E6675",
  amber:"#F2A413", amberHi:"#FFB740",
  green:"#36D399", greenDim:"#1f6b50",
  red:"#F0594C", redDim:"#6b2722",
  blue:"#4DA3FF", purple:"#A78BFA",
};
const LANES = ["Available","Assigned","In Transit","Delivered"];
const DRIVER_ORDER = ["TJ","John","Chris","Jeremy","Derek"];
const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const sans = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/* ============================ HELPERS ============================ */
const fmt0 = n => (n==null||isNaN(n)) ? "—" : Math.round(n).toLocaleString();
const money = n => (n==null||isNaN(n)) ? "—" : "$"+Math.round(n).toLocaleString();
const money1 = n => (n==null||isNaN(n)) ? "—" : "$"+Number(n).toFixed(2);
const uid = () => "l"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const todayISO = () => new Date().toISOString().slice(0,10);

function rpmColor(rpm){
  if(rpm==null||isNaN(rpm)) return C.faint;
  if(rpm>=2.5) return C.green;
  if(rpm>=1.8) return C.amber;
  return C.red;
}
function rpmLabel(rpm){
  if(rpm==null||isNaN(rpm)) return "no rpm";
  if(rpm>=2.5) return "strong";
  if(rpm>=1.8) return "ok";
  return "thin";
}
function laneColor(s){
  return s==="Available"?C.amber : s==="Assigned"?C.purple : s==="In Transit"?C.blue : C.green;
}
function computeRpm(l){
  if(l.rpm!=null) return l.rpm;
  if(l.rate&&l.miles) return l.rate/l.miles;
  return null;
}
function netOf(l){ return (l.rate||0)-(l.pay||0)-(l.fuel||0)-(l.dispatch||0)-(l.repair||0); }

/* ============================ STORAGE ============================ */
const KEY_LOADS="tms_loads_v3", KEY_CHAT="tms_chat_v3", KEY_INBOX="tms_inbox_v3";
async function sget(k,shared){ try{ const r=await window.storage.get(k,shared); return r? JSON.parse(r.value):null; }catch(e){ return null; } }
async function sset(k,v,shared){ try{ await window.storage.set(k,JSON.stringify(v),shared); }catch(e){} }

/* ============================ AI ============================ */
async function callClaude(messages, system, maxTokens=1200){
  const res = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:maxTokens, system, messages })
  });
  if(!res.ok) throw new Error("AI request failed ("+res.status+")");
  const data = await res.json();
  return (data.content||[]).map(b=>b.type==="text"?b.text:"").filter(Boolean).join("\n");
}
function parseJSON(text){
  let t=(text||"").trim().replace(/^```(json)?/i,"").replace(/```$/,"").trim();
  const a=t.indexOf("{"), b=t.lastIndexOf("}");
  if(a>=0&&b>=0) t=t.slice(a,b+1);
  return JSON.parse(t);
}

/* ============================ SMALL UI ============================ */
function Pill({children,color,bg,style}){
  return <span style={{fontFamily:mono,fontSize:10,letterSpacing:.5,textTransform:"uppercase",
    color:color||C.dim, background:bg||"transparent", border:`1px solid ${(color||C.line)}33`,
    padding:"2px 7px", borderRadius:4, whiteSpace:"nowrap", ...style}}>{children}</span>;
}
function Label({children,style}){
  return <div style={{fontFamily:sans,fontSize:10.5,letterSpacing:1.4,textTransform:"uppercase",color:C.faint,...style}}>{children}</div>;
}

/* ============================ KPI BAR ============================ */
function KpiBar({loads}){
  const k = useMemo(()=>{
    let rev=0,mi=0,rpmN=0,rpmC=0,pay=0,fuel=0,disp=0,rep=0,active=0;
    const wk = Date.now()-7*864e5;
    let wkRev=0;
    loads.forEach(l=>{
      rev+=l.rate||0; mi+=l.miles||0; pay+=l.pay||0; fuel+=l.fuel||0; disp+=l.dispatch||0; rep+=l.repair||0;
      const r=computeRpm(l); if(r!=null){rpmN+=r;rpmC++;}
      if(l.status!=="Delivered") active++;
      if(l.date && new Date(l.date).getTime()>=wk) wkRev+=l.rate||0;
    });
    return {rev,mi,avgRpm:rpmC?rpmN/rpmC:0,pay,fuel,disp,rep,active,margin:rev-pay-fuel-disp-rep,wkRev,count:loads.length};
  },[loads]);
  const items=[
    {k:"Booked revenue",v:money(k.rev),c:C.ink},
    {k:"Net (after all costs)",v:money(k.margin),c:k.margin>=0?C.green:C.red},
    {k:"Avg RPM",v:"$"+k.avgRpm.toFixed(2),c:rpmColor(k.avgRpm)},
    {k:"Total miles",v:fmt0(k.mi),c:C.ink},
    {k:"Active loads",v:fmt0(k.active),c:C.amber},
    {k:"Loads logged",v:fmt0(k.count),c:C.dim},
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-px" style={{background:C.line,border:`1px solid ${C.line}`,borderRadius:8,overflow:"hidden"}}>
      {items.map((it,i)=>(
        <div key={i} style={{background:C.panel,padding:"12px 14px"}}>
          <Label>{it.k}</Label>
          <div style={{fontFamily:mono,fontSize:21,fontWeight:600,color:it.c,marginTop:5,lineHeight:1}}>{it.v}</div>
        </div>
      ))}
    </div>
  );
}

/* ============================ LOAD CARD ============================ */
function LoadCard({l,onAssign,onAdvance,onBack,onDelete,drivers,compact}){
  const rpm=computeRpm(l), col=rpmColor(rpm);
  return (
    <div style={{background:C.panel2,border:`1px solid ${C.line}`,borderLeft:`3px solid ${col}`,
      borderRadius:7,padding:"10px 11px",display:"flex",flexDirection:"column",gap:7}}>
      <div className="flex items-start justify-between" style={{gap:8}}>
        <div style={{minWidth:0}}>
          <div style={{fontFamily:sans,fontSize:13.5,fontWeight:600,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.broker||"—"}</div>
          <div style={{fontFamily:mono,fontSize:10.5,color:C.dim,marginTop:2}}>
            {(l.origin||l.dest)?`${l.origin||"?"} → ${l.dest||"?"}`:(l.ref?("REF "+l.ref):(l.date||""))}
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontFamily:mono,fontSize:18,fontWeight:700,color:col,lineHeight:1}}>{rpm!=null?("$"+rpm.toFixed(2)):"—"}</div>
          <div style={{fontFamily:mono,fontSize:9,letterSpacing:.5,textTransform:"uppercase",color:col}}>{rpmLabel(rpm)} · rpm</div>
        </div>
      </div>
      <div className="flex items-center" style={{gap:14}}>
        <div><span style={{fontFamily:mono,fontSize:15,fontWeight:600,color:C.ink}}>{money(l.rate)}</span></div>
        <div style={{fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(l.miles)} mi</div>
        {l.unit && <Pill color={C.faint}>unit {l.unit}</Pill>}
      </div>

      {!compact && (
        <div className="flex items-center justify-between" style={{gap:8,marginTop:1}}>
          {l.status==="Available" ? (
            <select value="" onChange={e=>onAssign(l.id,e.target.value)}
              style={{flex:1,background:C.raised,color:C.amber,border:`1px solid ${C.line}`,borderRadius:5,
                padding:"5px 7px",fontFamily:mono,fontSize:11.5}}>
              <option value="" style={{color:C.dim}}>Assign driver…</option>
              {drivers.map(d=><option key={d} value={d} style={{color:C.ink}}>{d}</option>)}
            </select>
          ) : (
            <div className="flex items-center" style={{gap:6}}>
              <div style={{width:7,height:7,borderRadius:9,background:laneColor(l.status)}}/>
              <span style={{fontFamily:mono,fontSize:12,color:C.ink}}>{l.driver||"unassigned"}</span>
            </div>
          )}
          <div className="flex items-center" style={{gap:5}}>
            {l.status!=="Available" && <IconBtn title="Back a stage" onClick={()=>onBack(l.id)}>‹</IconBtn>}
            {l.status!=="Delivered" && (
              <button onClick={()=>onAdvance(l.id)} style={{fontFamily:mono,fontSize:11,letterSpacing:.3,
                color:C.bg,background:laneColor(LANES[LANES.indexOf(l.status)+1]),border:"none",
                borderRadius:5,padding:"5px 9px",cursor:"pointer",fontWeight:600}}>
                {l.status==="Available"?"—":LANES[LANES.indexOf(l.status)+1]} ›
              </button>
            )}
            {onDelete && <IconBtn title="Remove" onClick={()=>onDelete(l.id)} danger>×</IconBtn>}
          </div>
        </div>
      )}
    </div>
  );
}
function IconBtn({children,onClick,title,danger}){
  return <button title={title} onClick={onClick} style={{width:26,height:26,borderRadius:5,
    background:C.raised,border:`1px solid ${C.line}`,color:danger?C.red:C.dim,cursor:"pointer",
    fontFamily:mono,fontSize:14,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}>{children}</button>;
}

/* ============================ BOARD ============================ */
function Board({loads,setLoads,drivers,onNewLoad}){
  const grouped = useMemo(()=>{
    const g={Available:[],Assigned:[],"In Transit":[],Delivered:[]};
    loads.forEach(l=>{ (g[l.status]||g.Delivered).push(l); });
    g.Delivered.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    return g;
  },[loads]);

  const upd=(id,patch)=>setLoads(loads.map(l=>l.id===id?{...l,...patch}:l));
  const assign=(id,driver)=>upd(id,{driver,status:"Assigned"});
  const advance=id=>{const l=loads.find(x=>x.id===id);const i=LANES.indexOf(l.status);if(i<LANES.length-1)upd(id,{status:LANES[i+1]});};
  const back=id=>{const l=loads.find(x=>x.id===id);const i=LANES.indexOf(l.status);if(i>0)upd(id,{status:LANES[i-1], ...(LANES[i-1]==="Available"?{driver:null}:{})});};
  const del=id=>setLoads(loads.filter(l=>l.id!==id));

  return (
    <div>
      <div className="flex items-center justify-between" style={{marginBottom:12}}>
        <Label style={{fontSize:11}}>Dispatch board · drag-free, tap to advance</Label>
        <button onClick={onNewLoad} style={{fontFamily:mono,fontSize:12,color:C.bg,background:C.amber,
          border:"none",borderRadius:6,padding:"7px 13px",cursor:"pointer",fontWeight:700,letterSpacing:.3}}>+ New load</button>
      </div>
      <div className="flex flex-col lg:flex-row" style={{gap:12,alignItems:"stretch"}}>
        {LANES.map(lane=>{
          const list=grouped[lane];
          const rev=list.reduce((s,l)=>s+(l.rate||0),0);
          const rpms=list.map(computeRpm).filter(x=>x!=null);
          const avg=rpms.length?rpms.reduce((a,b)=>a+b,0)/rpms.length:null;
          const isDel=lane==="Delivered";
          const show=isDel?list.slice(0,12):list;
          return (
            <div key={lane} className="flex-1" style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:9,minWidth:0,display:"flex",flexDirection:"column"}}>
              <div style={{padding:"11px 12px",borderBottom:`1px solid ${C.lineSoft}`}}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center" style={{gap:7}}>
                    <div style={{width:8,height:8,borderRadius:9,background:laneColor(lane)}}/>
                    <span style={{fontFamily:sans,fontSize:12.5,fontWeight:700,letterSpacing:.6,textTransform:"uppercase",color:C.ink}}>{lane}</span>
                  </div>
                  <span style={{fontFamily:mono,fontSize:12,color:C.dim}}>{list.length}</span>
                </div>
                <div className="flex items-center justify-between" style={{marginTop:6}}>
                  <span style={{fontFamily:mono,fontSize:12,color:C.faint}}>{money(rev)}</span>
                  {avg!=null && <span style={{fontFamily:mono,fontSize:11,color:rpmColor(avg)}}>avg ${avg.toFixed(2)}</span>}
                </div>
              </div>
              <div style={{padding:10,display:"flex",flexDirection:"column",gap:9,overflowY:"auto",maxHeight:560}}>
                {show.length===0 && <div style={{fontFamily:mono,fontSize:11,color:C.faint,padding:"14px 4px",textAlign:"center"}}>{lane==="Available"?"Add a load or pull one from Rate Cons.":"Nothing here."}</div>}
                {show.map(l=><LoadCard key={l.id} l={l} drivers={drivers} onAssign={assign} onAdvance={advance} onBack={back} onDelete={isDel?null:del} compact={isDel}/>)}
                {isDel && list.length>12 && <div style={{fontFamily:mono,fontSize:11,color:C.faint,textAlign:"center",padding:4}}>+{list.length-12} more in Loads ledger</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ LOADS LEDGER ============================ */
function Ledger({loads}){
  const [q,setQ]=useState(""); const [drv,setDrv]=useState("all"); const [sort,setSort]=useState("date");
  const drivers=useMemo(()=>["all",...Array.from(new Set(loads.map(l=>l.driver).filter(Boolean)))],[loads]);
  const rows=useMemo(()=>{
    let r=loads.filter(l=>{
      const okD = drv==="all"||l.driver===drv;
      const okQ = !q || (l.broker||"").toLowerCase().includes(q.toLowerCase()) || (l.driver||"").toLowerCase().includes(q.toLowerCase());
      return okD&&okQ;
    });
    r=[...r].sort((a,b)=>{
      if(sort==="date") return (b.date||"").localeCompare(a.date||"");
      if(sort==="rpm") return (computeRpm(b)||0)-(computeRpm(a)||0);
      if(sort==="rate") return (b.rate||0)-(a.rate||0);
      return 0;
    });
    return r;
  },[loads,q,drv,sort]);
  return (
    <div>
      <div className="flex flex-wrap items-center" style={{gap:8,marginBottom:12}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search broker or driver…"
          style={{flex:"1 1 200px",background:C.panel,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"8px 11px",fontFamily:mono,fontSize:12.5}}/>
        <select value={drv} onChange={e=>setDrv(e.target.value)} style={selStyle}>{drivers.map(d=><option key={d} value={d}>{d==="all"?"All drivers":d}</option>)}</select>
        <select value={sort} onChange={e=>setSort(e.target.value)} style={selStyle}>
          <option value="date">Newest</option><option value="rpm">Highest RPM</option><option value="rate">Highest rate</option>
        </select>
        <Pill color={C.dim}>{rows.length} loads</Pill>
      </div>
      <div style={{border:`1px solid ${C.line}`,borderRadius:9,overflow:"hidden"}}>
        <div className="hidden md:grid" style={{gridTemplateColumns:"80px 1fr 92px 56px 52px 70px 64px 64px 60px 66px",
          background:C.panel2,padding:"9px 12px",gap:8}}>
          {["Date","Broker","Driver","RPM","Miles","Rate","Pay","Fuel","Disp","Repair"].map((h,i)=>(
            <div key={i} style={{fontFamily:sans,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:C.faint,textAlign:i>2?"right":"left"}}>{h}</div>
          ))}
        </div>
        <div style={{maxHeight:600,overflowY:"auto"}}>
          {rows.map((l,idx)=>{const rpm=computeRpm(l);return(
            <div key={l.id} className="grid grid-cols-2 md:grid-cols-none" style={{gridTemplateColumns:"80px 1fr 92px 56px 52px 70px 64px 64px 60px 66px",
              gap:8,padding:"9px 12px",background:idx%2?C.bg:C.panel,borderTop:`1px solid ${C.lineSoft}`,alignItems:"center"}}>
              <div style={{fontFamily:mono,fontSize:11.5,color:C.dim}}>{(l.date||"").slice(5)}</div>
              <div style={{fontFamily:sans,fontSize:12.5,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.broker||"—"}</div>
              <div style={{fontFamily:mono,fontSize:11.5,color:C.dim}}>{l.driver||"—"}{l.unit?(" · "+l.unit):""}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:rpmColor(rpm)}}>{rpm!=null?"$"+rpm.toFixed(2):"—"}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(l.miles)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.ink}}>{money(l.rate)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(l.pay)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(l.fuel)}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.dim}}>{l.dispatch?money(l.dispatch):"—"}</div>
              <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:l.repair?C.amber:C.dim}}>{l.repair?money(l.repair):"—"}</div>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}
const selStyle={background:C.panel,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"8px 10px",fontFamily:mono,fontSize:12};

/* ============================ DRIVERS ============================ */
function Drivers({loads}){
  const stats=useMemo(()=>{
    const m={};
    loads.forEach(l=>{
      if(!l.driver) return;
      const d=m[l.driver]||(m[l.driver]={driver:l.driver,n:0,miles:0,rev:0,pay:0,fuel:0,disp:0,rep:0,rpmN:0,rpmC:0,units:new Set(),active:null});
      d.n++; d.miles+=l.miles||0; d.rev+=l.rate||0; d.pay+=l.pay||0; d.fuel+=l.fuel||0; d.disp+=l.dispatch||0; d.rep+=l.repair||0;
      const r=computeRpm(l); if(r!=null){d.rpmN+=r;d.rpmC++;}
      if(l.unit) d.units.add(l.unit);
      if(l.status&&l.status!=="Delivered") d.active=l;
    });
    return Object.values(m).map(d=>({...d,avg:d.rpmC?d.rpmN/d.rpmC:0,margin:d.rev-d.pay-d.fuel-d.disp-d.rep,units:Array.from(d.units)}))
      .sort((a,b)=>{const ia=DRIVER_ORDER.indexOf(a.driver),ib=DRIVER_ORDER.indexOf(b.driver);return (ia<0?99:ia)-(ib<0?99:ib);});
  },[loads]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" style={{gap:12}}>
      {stats.map(d=>(
        <div key={d.driver} style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:14}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center" style={{gap:10}}>
              <div style={{width:36,height:36,borderRadius:8,background:C.raised,border:`1px solid ${C.line}`,
                display:"flex",alignItems:"center",justifyContent:"center",fontFamily:mono,fontWeight:700,color:C.amber,fontSize:14}}>{d.driver.slice(0,2).toUpperCase()}</div>
              <div>
                <div style={{fontFamily:sans,fontSize:15,fontWeight:700,color:C.ink}}>{d.driver}</div>
                <div style={{fontFamily:mono,fontSize:10.5,color:C.faint}}>units {d.units.join(", ")||"—"}</div>
              </div>
            </div>
            {d.active
              ? <Pill color={laneColor(d.active.status)} bg={laneColor(d.active.status)+"1a"}>{d.active.status}</Pill>
              : <Pill color={C.faint}>open</Pill>}
          </div>
          {d.active && <div style={{marginTop:10,padding:"8px 10px",background:C.panel2,border:`1px solid ${C.line}`,borderRadius:7,fontFamily:mono,fontSize:11.5,color:C.dim}}>
            on: <span style={{color:C.ink}}>{d.active.broker}</span> · {money(d.active.rate)} · {fmt0(d.active.miles)}mi</div>}
          <div className="grid grid-cols-3" style={{gap:8,marginTop:12}}>
            {[["Loads",fmt0(d.n),C.ink],["Revenue",money(d.rev),C.ink],["Avg RPM","$"+d.avg.toFixed(2),rpmColor(d.avg)],
              ["Miles",fmt0(d.miles),C.dim],["Driver pay",money(d.pay),C.dim],["Net to truck",money(d.margin),d.margin>=0?C.green:C.red]].map((s,i)=>(
              <div key={i}>
                <Label style={{fontSize:9}}>{s[0]}</Label>
                <div style={{fontFamily:mono,fontSize:14,fontWeight:600,color:s[2],marginTop:3}}>{s[1]}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================ WEEKLY P&L PER TRUCK ============================ */
function isoMonday(d){ const dt=new Date(d+"T00:00:00"); const day=(dt.getDay()+6)%7; dt.setDate(dt.getDate()-day); return dt.toISOString().slice(0,10); }
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function weekLabel(monIso){ const a=new Date(monIso+"T00:00:00"); const b=new Date(a); b.setDate(b.getDate()+6);
  const sameM=a.getMonth()===b.getMonth(); return `${MON[a.getMonth()]} ${a.getDate()} – ${sameM?'':MON[b.getMonth()]+' '}${b.getDate()}`; }

function WeeklyPnL({loads}){
  const weeks=useMemo(()=>{ const m={}; loads.forEach(l=>{ if(!l.date)return; const wk=isoMonday(l.date); (m[wk]||(m[wk]=[])).push(l); });
    return Object.keys(m).sort((a,b)=>b.localeCompare(a)).map(k=>({wk:k,loads:m[k]})); },[loads]);
  const [sel,setSel]=useState(""); 
  useEffect(()=>{ if(weeks.length&&!weeks.find(w=>w.wk===sel)) setSel(weeks[0].wk); },[weeks]);
  const cur=weeks.find(w=>w.wk===sel)||weeks[0];

  const trend=useMemo(()=>weeks.slice(0,14).reverse().map(w=>{ let net=0; w.loads.forEach(l=>net+=(l.rate||0)-(l.pay||0)-(l.fuel||0)); return {wk:w.wk,net}; }),[weeks]);
  const maxNet=Math.max(1,...trend.map(t=>Math.abs(t.net)));

  const trucks=useMemo(()=>{ if(!cur) return []; const m={};
    cur.loads.forEach(l=>{ const u=l.unit||"—"; const t=m[u]||(m[u]={unit:u,drivers:new Set(),n:0,miles:0,rev:0,pay:0,fuel:0,exp:0,rpmN:0,rpmC:0});
      t.n++; t.miles+=l.miles||0; t.rev+=l.rate||0; t.pay+=l.pay||0; t.fuel+=l.fuel||0; t.exp+=(l.dispatch||0)+(l.repair||0); const r=computeRpm(l); if(r){t.rpmN+=r;t.rpmC++;} if(l.driver)t.drivers.add(l.driver); });
    return Object.values(m).map(t=>({...t,net:t.rev-t.pay-t.fuel-t.exp,avg:t.rpmC?t.rpmN/t.rpmC:0,drivers:Array.from(t.drivers)})).sort((a,b)=>b.rev-a.rev); },[cur]);
  const tot=trucks.reduce((s,t)=>({rev:s.rev+t.rev,pay:s.pay+t.pay,fuel:s.fuel+t.fuel,exp:s.exp+t.exp,net:s.net+t.net,miles:s.miles+t.miles,n:s.n+t.n}),{rev:0,pay:0,fuel:0,exp:0,net:0,miles:0,n:0});

  if(!cur) return <Empty msg="No dated loads yet."/>;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between" style={{gap:10,marginBottom:14}}>
        <div className="flex items-center" style={{gap:10}}>
          <Label>Week of</Label>
          <select value={sel} onChange={e=>setSel(e.target.value)} style={{...selStyle,fontSize:13}}>
            {weeks.map(w=><option key={w.wk} value={w.wk}>{weekLabel(w.wk)}, {w.wk.slice(0,4)}</option>)}
          </select>
        </div>
        <div className="flex items-center" style={{gap:18}}>
          <Stat k="Revenue" v={money(tot.rev)} c={C.ink}/>
          <Stat k="Net to fleet" v={money(tot.net)} c={tot.net>=0?C.green:C.red}/>
          <Stat k="Miles" v={fmt0(tot.miles)} c={C.dim}/>
          <Stat k="Avg RPM" v={"$"+(tot.miles?(tot.rev/tot.miles):0).toFixed(2)} c={rpmColor(tot.miles?tot.rev/tot.miles:0)}/>
        </div>
      </div>

      {/* trend */}
      <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
        <Label style={{marginBottom:10}}>Weekly net to fleet · last {trend.length} weeks</Label>
        <div className="flex items-end" style={{gap:6,height:90}}>
          {trend.map(t=>{ const h=Math.max(3,Math.round(Math.abs(t.net)/maxNet*78)); const on=t.wk===sel;
            return (
              <div key={t.wk} onClick={()=>setSel(t.wk)} title={weekLabel(t.wk)+": "+money(t.net)}
                className="flex-1" style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center",cursor:"pointer",minWidth:0}}>
                <div style={{width:"100%",maxWidth:26,height:h,background:t.net>=0?(on?C.green:C.greenDim):(on?C.red:C.redDim),borderRadius:3}}/>
                <div style={{fontFamily:mono,fontSize:8.5,color:on?C.ink:C.faint,marginTop:5}}>{MON[new Date(t.wk+"T00:00:00").getMonth()]}{new Date(t.wk+"T00:00:00").getDate()}</div>
              </div>
            ); })}
        </div>
      </div>

      {/* per truck table */}
      <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden"}}>
        <div className="hidden md:grid" style={{gridTemplateColumns:"60px 1fr 46px 56px 80px 70px 70px 70px 78px 58px",background:C.panel2,padding:"9px 12px",gap:8}}>
          {["Truck","Driver","Loads","Miles","Revenue","Pay","Fuel","Exp","Net","RPM"].map((h,i)=>(
            <div key={i} style={{fontFamily:sans,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:C.faint,textAlign:i>1?"right":"left"}}>{h}</div>))}
        </div>
        {trucks.map((t,i)=>(
          <div key={t.unit} style={{display:"grid",gridTemplateColumns:"60px 1fr 46px 56px 80px 70px 70px 70px 78px 58px",gap:8,padding:"11px 12px",background:i%2?C.bg:C.panel,borderTop:`1px solid ${C.lineSoft}`,alignItems:"center"}}>
            <div className="flex items-center" style={{gap:7}}><div style={{width:9,height:9,borderRadius:3,background:C.amber}}/><span style={{fontFamily:mono,fontWeight:700,color:C.ink,fontSize:14}}>{t.unit}</span></div>
            <div style={{fontFamily:sans,fontSize:12.5,color:C.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.drivers.join(", ")||"—"}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.dim}}>{t.n}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(t.miles)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:13,color:C.ink}}>{money(t.rev)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(t.pay)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(t.fuel)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{t.exp?money(t.exp):"—"}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:13,fontWeight:700,color:t.net>=0?C.green:C.red}}>{money(t.net)}</div>
            <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:rpmColor(t.avg)}}>${t.avg.toFixed(2)}</div>
          </div>
        ))}
        <div style={{display:"grid",gridTemplateColumns:"60px 1fr 46px 56px 80px 70px 70px 70px 78px 58px",gap:8,padding:"11px 12px",background:C.panel2,borderTop:`2px solid ${C.line}`,alignItems:"center"}}>
          <div style={{fontFamily:sans,fontSize:11,letterSpacing:.8,textTransform:"uppercase",color:C.amber,fontWeight:700,gridColumn:"1 / 3"}}>Week total</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.dim}}>{tot.n}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(tot.miles)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:13,color:C.ink}}>{money(tot.rev)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(tot.pay)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(tot.fuel)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{tot.exp?money(tot.exp):"—"}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:13,fontWeight:700,color:tot.net>=0?C.green:C.red}}>{money(tot.net)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:rpmColor(tot.miles?tot.rev/tot.miles:0)}}>${(tot.miles?tot.rev/tot.miles:0).toFixed(2)}</div>
        </div>
      </div>
      <div style={{fontFamily:sans,fontSize:11,color:C.faint,marginTop:10}}>Net = revenue − driver pay − fuel − dispatch fees − repairs. Exp = dispatch fees + repairs. Truck = unit number. Tap a bar to jump to that week.</div>
    </div>
  );
}
function Stat({k,v,c}){ return <div><Label style={{fontSize:9}}>{k}</Label><div style={{fontFamily:mono,fontSize:17,fontWeight:600,color:c,marginTop:2,lineHeight:1}}>{v}</div></div>; }
function Empty({msg}){ return <div style={{fontFamily:mono,fontSize:12.5,color:C.faint,textAlign:"center",padding:"50px 20px",border:`1px dashed ${C.line}`,borderRadius:10}}>{msg}</div>; }

/* ============================ MONTHLY P&L ============================ */
function monthLabel(ym){ const [y,m]=ym.split("-"); return `${MON[parseInt(m,10)-1]} ${y}`; }
function aggLoads(list){
  let rev=0,pay=0,fuel=0,disp=0,rep=0,miles=0,rpmN=0,rpmC=0;
  list.forEach(l=>{ rev+=l.rate||0; pay+=l.pay||0; fuel+=l.fuel||0; disp+=l.dispatch||0; rep+=l.repair||0; miles+=l.miles||0;
    const r=computeRpm(l); if(r!=null){rpmN+=r;rpmC++;} });
  return {rev,pay,fuel,disp,rep,exp:disp+rep,miles,n:list.length,net:rev-pay-fuel-disp-rep,avg:rpmC?rpmN/rpmC:0};
}
function trucksOf(list){
  const m={};
  list.forEach(l=>{ const u=l.unit||"—"; const t=m[u]||(m[u]={unit:u,loads:[],drivers:new Set()}); t.loads.push(l); if(l.driver)t.drivers.add(l.driver); });
  return Object.values(m).map(t=>({unit:t.unit,drivers:Array.from(t.drivers),...aggLoads(t.loads)})).sort((a,b)=>b.rev-a.rev);
}
const M_GRID="118px 44px 60px 84px 72px 72px 66px 84px 58px";
function MonthlyPnL({loads}){
  const years=useMemo(()=>Array.from(new Set(loads.filter(l=>l.date).map(l=>l.date.slice(0,4)))).sort((a,b)=>b.localeCompare(a)),[loads]);
  const [year,setYear]=useState("");
  useEffect(()=>{ if(years.length && year!=="all" && !years.includes(year)) setYear(years[0]); },[years]);
  const view=useMemo(()=> (year&&year!=="all") ? loads.filter(l=>l.date&&l.date.slice(0,4)===year) : loads.filter(l=>l.date), [loads,year]);
  const months=useMemo(()=>{
    const m={}; view.forEach(l=>{ const ym=l.date.slice(0,7); (m[ym]||(m[ym]=[])).push(l); });
    return Object.keys(m).sort((a,b)=>b.localeCompare(a)).map(k=>({ym:k,loads:m[k],agg:aggLoads(m[k])}));
  },[view]);
  const [open,setOpen]=useState(new Set());
  useEffect(()=>{ if(months.length) setOpen(o=>o.size?o:new Set([months[0].ym])); },[months.length]);
  const toggle=ym=>setOpen(o=>{ const n=new Set(o); n.has(ym)?n.delete(ym):n.add(ym); return n; });

  const tot=useMemo(()=>aggLoads(view),[view]);
  const trend=useMemo(()=>months.slice(0,12).reverse(),[months]);
  const maxNet=Math.max(1,...trend.map(t=>Math.abs(t.agg.net)));
  const avgMonthNet=months.length?tot.net/months.length:0;

  if(!months.length) return <Empty msg="No dated loads yet — monthly P&L builds as loads come in."/>;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between" style={{gap:12,marginBottom:14}}>
        <div className="flex items-center" style={{gap:12,flexWrap:"wrap"}}>
          <div className="flex" style={{gap:3,background:C.panel,border:`1px solid ${C.line}`,borderRadius:9,padding:3}}>
            {[...years,"all"].map(y=>{ const on=(y==="all")?(year==="all"):((year||years[0])===y);
              return <button key={y} onClick={()=>setYear(y)} style={{fontFamily:mono,fontSize:12.5,fontWeight:700,letterSpacing:.3,
                color:on?C.bg:C.dim,background:on?C.amber:"transparent",border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer"}}>{y==="all"?"All":y}</button>; })}
          </div>
          <Label style={{fontSize:11}}>{months.length} month{months.length===1?"":"s"} · tap a month for trucks</Label>
        </div>
        <div className="flex items-center" style={{gap:18}}>
          <Stat k={(year&&year!=="all")?(year+" net"):"All-time net"} v={money(tot.net)} c={tot.net>=0?C.green:C.red}/>
          <Stat k="Avg / month" v={money(avgMonthNet)} c={avgMonthNet>=0?C.green:C.red}/>
          <Stat k="Avg RPM" v={"$"+(tot.miles?tot.rev/tot.miles:0).toFixed(2)} c={rpmColor(tot.miles?tot.rev/tot.miles:0)}/>
        </div>
      </div>

      {/* monthly net trend */}
      <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
        <Label style={{marginBottom:10}}>Monthly net to fleet · last {trend.length} months</Label>
        <div className="flex items-end" style={{gap:8,height:96}}>
          {trend.map(t=>{ const h=Math.max(3,Math.round(Math.abs(t.agg.net)/maxNet*72)); const on=open.has(t.ym);
            return (
              <div key={t.ym} onClick={()=>setOpen(new Set([t.ym]))} title={monthLabel(t.ym)+": "+money(t.agg.net)}
                className="flex-1" style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center",cursor:"pointer",minWidth:0}}>
                <div style={{fontFamily:mono,fontSize:8.5,color:on?C.ink:C.faint,marginBottom:3}}>{(t.agg.net/1000).toFixed(0)}k</div>
                <div style={{width:"100%",maxWidth:30,height:h,background:t.agg.net>=0?(on?C.green:C.greenDim):(on?C.red:C.redDim),borderRadius:3}}/>
                <div style={{fontFamily:mono,fontSize:8.5,color:on?C.ink:C.faint,marginTop:5}}>{MON[parseInt(t.ym.slice(5),10)-1]}</div>
              </div>
            ); })}
        </div>
      </div>

      {/* monthly table */}
      <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden"}}>
        <div className="hidden md:grid" style={{gridTemplateColumns:M_GRID,background:C.panel2,padding:"9px 12px",gap:8}}>
          {["Month","Loads","Miles","Revenue","Pay","Fuel","Exp","Net","RPM"].map((h,i)=>(
            <div key={i} style={{fontFamily:sans,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:C.faint,textAlign:i>0?"right":"left"}}>{h}</div>))}
        </div>
        {months.map((mo,i)=>{ const a=mo.agg; const isOpen=open.has(mo.ym);
          return (
            <div key={mo.ym} style={{borderTop:`1px solid ${C.lineSoft}`}}>
              <div onClick={()=>toggle(mo.ym)} style={{display:"grid",gridTemplateColumns:M_GRID,gap:8,padding:"11px 12px",background:isOpen?C.panel2:(i%2?C.bg:C.panel),alignItems:"center",cursor:"pointer"}}>
                <div className="flex items-center" style={{gap:6,minWidth:0}}>
                  <span style={{color:C.faint,fontFamily:mono,fontSize:11,width:9}}>{isOpen?"▾":"▸"}</span>
                  <span style={{fontFamily:sans,fontSize:13,fontWeight:700,color:C.ink,whiteSpace:"nowrap"}}>{monthLabel(mo.ym)}</span>
                </div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.dim}}>{a.n}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(a.miles)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:13,color:C.ink}}>{money(a.rev)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(a.pay)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(a.fuel)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{a.exp?money(a.exp):"—"}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:13,fontWeight:700,color:a.net>=0?C.green:C.red}}>{money(a.net)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:rpmColor(a.avg)}}>${a.avg.toFixed(2)}</div>
              </div>
              {isOpen && (
                <div style={{background:C.bg,padding:"4px 12px 12px 12px"}}>
                  {trucksOf(mo.loads).map(t=>(
                    <div key={t.unit} style={{display:"grid",gridTemplateColumns:M_GRID,gap:8,padding:"7px 0 7px 18px",alignItems:"center",borderTop:`1px solid ${C.lineSoft}`}}>
                      <div className="flex items-center" style={{gap:6,minWidth:0}}>
                        <div style={{width:7,height:7,borderRadius:2,background:C.amber}}/>
                        <span style={{fontFamily:mono,fontSize:12,color:C.ink}}>Unit {t.unit}</span>
                        <span style={{fontFamily:sans,fontSize:10.5,color:C.faint,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.drivers.join(", ")}</span>
                      </div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.faint}}>{t.n}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.faint}}>{fmt0(t.miles)}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(t.rev)}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.faint}}>{money(t.pay)}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.faint}}>{money(t.fuel)}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:C.faint}}>{t.exp?money(t.exp):"—"}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:12,fontWeight:600,color:t.net>=0?C.green:C.red}}>{money(t.net)}</div>
                      <div style={{textAlign:"right",fontFamily:mono,fontSize:11.5,color:rpmColor(t.avg)}}>${t.avg.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div style={{display:"grid",gridTemplateColumns:M_GRID,gap:8,padding:"11px 12px",background:C.panel2,borderTop:`2px solid ${C.line}`,alignItems:"center"}}>
          <div style={{fontFamily:sans,fontSize:11,letterSpacing:.8,textTransform:"uppercase",color:C.amber,fontWeight:700}}>{(year&&year!=="all")?year+" total":"All-time"}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:C.dim}}>{tot.n}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{fmt0(tot.miles)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:13,color:C.ink}}>{money(tot.rev)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(tot.pay)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(tot.fuel)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{tot.exp?money(tot.exp):"—"}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:13,fontWeight:700,color:tot.net>=0?C.green:C.red}}>{money(tot.net)}</div>
          <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,color:rpmColor(tot.miles?tot.rev/tot.miles:0)}}>${(tot.miles?tot.rev/tot.miles:0).toFixed(2)}</div>
        </div>
      </div>
      <div style={{fontFamily:sans,fontSize:11,color:C.faint,marginTop:10}}>Net = revenue − driver pay − fuel − dispatch fees − repairs. Exp = dispatch + repairs. Tap any month to see each truck's P&amp;L for that month.</div>
    </div>
  );
}

/* ============================ LANE BOOK ============================ */
function LaneBook({loads}){
  const withLane=useMemo(()=>loads.filter(l=>l.origin&&l.origin.trim()),[loads]);
  const origins=useMemo(()=>["all",...Array.from(new Set(withLane.map(l=>l.origin.trim())))],[withLane]);
  const [origin,setOrigin]=useState("all");

  const byOrigin=useMemo(()=>{
    const m={};
    withLane.forEach(l=>{
      if(origin!=="all"&&l.origin.trim()!==origin) return;
      const o=l.origin.trim(), d=(l.dest||"?").trim(), b=l.broker||"—", key=o+"|"+d+"|"+b;
      const e=m[key]||(m[key]={origin:o,dest:d,broker:b,n:0,rpmN:0,rpmC:0,rate:0,miles:0,last:""});
      e.n++; const r=computeRpm(l); if(r){e.rpmN+=r;e.rpmC++;} e.rate+=l.rate||0; e.miles+=l.miles||0; if((l.date||"")>e.last)e.last=l.date||"";
    });
    const lanes=Object.values(m).map(e=>({...e,avgRpm:e.rpmC?e.rpmN/e.rpmC:0,avgRate:e.rate/e.n,avgMiles:Math.round(e.miles/e.n)}));
    const g={}; lanes.forEach(e=>{(g[e.origin]||(g[e.origin]=[])).push(e);});
    Object.values(g).forEach(a=>a.sort((x,y)=>y.n-x.n));
    return Object.entries(g).sort((a,b)=>b[1].reduce((s,x)=>s+x.n,0)-a[1].reduce((s,x)=>s+x.n,0));
  },[withLane,origin]);

  const brokerRef=useMemo(()=>{ const m={};
    loads.forEach(l=>{ if(!l.broker)return; const e=m[l.broker]||(m[l.broker]={broker:l.broker,n:0,rpmN:0,rpmC:0,rate:0,last:""});
      e.n++; const r=computeRpm(l); if(r){e.rpmN+=r;e.rpmC++;} e.rate+=l.rate||0; if((l.date||"")>e.last)e.last=l.date||""; });
    return Object.values(m).map(e=>({...e,avgRpm:e.rpmC?e.rpmN/e.rpmC:0,avgRate:e.rate/e.n})).sort((a,b)=>b.n-a.n);
  },[loads]);
  const [showRef,setShowRef]=useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between" style={{gap:10,marginBottom:14}}>
        <div className="flex items-center" style={{gap:10}}>
          <Label>Coming out of</Label>
          <select value={origin} onChange={e=>setOrigin(e.target.value)} style={{...selStyle,fontSize:13}}>
            {origins.map(o=><option key={o} value={o}>{o==="all"?"All origin cities":o}</option>)}
          </select>
        </div>
        <Pill color={C.dim}>{byOrigin.reduce((s,[,a])=>s+a.length,0)} lanes on file</Pill>
      </div>

      {byOrigin.length===0 ? (
        <div style={{border:`1px dashed ${C.line}`,borderRadius:10,padding:"28px 22px",textAlign:"center"}}>
          <div style={{fontFamily:sans,fontSize:14,color:C.ink,fontWeight:600}}>No city lanes recorded yet</div>
          <div style={{fontFamily:sans,fontSize:12,color:C.dim,marginTop:8,maxWidth:520,marginLeft:"auto",marginRight:"auto",lineHeight:1.5}}>
            Your imported history didn't include pickup/drop cities, so lanes start filling in as rate cons come through (the extractor captures origin and destination) or when you add a load with city fields. Your NC→IN and NC→OH runs will group here automatically. In the meantime, your broker rate reference below works off all 167 loads.
          </div>
        </div>
      ) : byOrigin.map(([orig,lanes])=>(
        <div key={orig} style={{marginBottom:14}}>
          <div className="flex items-center" style={{gap:9,marginBottom:8}}>
            <div style={{width:9,height:9,borderRadius:9,background:C.amber}}/>
            <span style={{fontFamily:sans,fontSize:14.5,fontWeight:700,color:C.ink}}>Out of {orig}</span>
            <Pill color={C.faint}>{lanes.length} lane{lanes.length>1?"s":""}</Pill>
          </div>
          <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden"}}>
            {lanes.map((e,i)=>(
              <div key={i} className="flex items-center justify-between" style={{padding:"11px 13px",gap:10,background:i%2?C.bg:C.panel,borderTop:i?`1px solid ${C.lineSoft}`:"none"}}>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontFamily:sans,fontSize:13.5,color:C.ink,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>→ {e.dest}</div>
                  <div style={{fontFamily:mono,fontSize:11,color:C.dim,marginTop:2}}>{e.broker} · {e.n} load{e.n>1?"s":""} · {fmt0(e.avgMiles)} mi avg · last {e.last? e.last.slice(5):"—"}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontFamily:mono,fontSize:16,fontWeight:700,color:rpmColor(e.avgRpm)}}>${e.avgRpm.toFixed(2)}</div>
                  <div style={{fontFamily:mono,fontSize:11,color:C.faint}}>{money(e.avgRate)} avg</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* broker reference fallback */}
      <div style={{marginTop:6}}>
        <button onClick={()=>setShowRef(!showRef)} style={{fontFamily:sans,fontSize:12.5,fontWeight:600,color:C.dim,background:C.panel,border:`1px solid ${C.line}`,borderRadius:8,padding:"9px 13px",cursor:"pointer",width:"100%",textAlign:"left"}}>
          {showRef?"▾":"▸"} Broker rate reference — all {brokerRef.length} brokers across full history (lane not recorded)
        </button>
        {showRef && (
          <div style={{border:`1px solid ${C.line}`,borderTop:"none",borderRadius:"0 0 8px 8px",overflow:"hidden",maxHeight:420,overflowY:"auto"}}>
            <div className="hidden md:grid" style={{gridTemplateColumns:"1fr 70px 64px 100px 80px",background:C.panel2,padding:"8px 13px",gap:8}}>
              {["Broker","Loads","RPM","Avg rate","Last"].map((h,i)=><div key={i} style={{fontFamily:sans,fontSize:10,letterSpacing:1,textTransform:"uppercase",color:C.faint,textAlign:i?"right":"left"}}>{h}</div>)}
            </div>
            {brokerRef.map((e,i)=>(
              <div key={e.broker} style={{display:"grid",gridTemplateColumns:"1fr 70px 64px 100px 80px",gap:8,padding:"9px 13px",background:i%2?C.bg:C.panel,borderTop:`1px solid ${C.lineSoft}`,alignItems:"center"}}>
                <div style={{fontFamily:sans,fontSize:12.5,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.broker}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{e.n}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12.5,fontWeight:600,color:rpmColor(e.avgRpm)}}>${e.avgRpm.toFixed(2)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:12,color:C.dim}}>{money(e.avgRate)}</div>
                <div style={{textAlign:"right",fontFamily:mono,fontSize:11,color:C.faint}}>{e.last?e.last.slice(5):"—"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ RATE CON INBOX ============================ */
function Inbox({onAdd}){
  const [text,setText]=useState(""); const [busy,setBusy]=useState(false);
  const [draft,setDraft]=useState(null); const [err,setErr]=useState("");
  const [recent,setRecent]=useState([]);
  useEffect(()=>{ sget(KEY_INBOX,true).then(v=>v&&setRecent(v)); },[]);

  async function extract(){
    if(!text.trim()) return;
    setBusy(true); setErr(""); setDraft(null);
    try{
      const sys="You extract a freight load from a pasted broker email or rate confirmation. Respond ONLY with one JSON object, no prose, no code fences. Keys: broker (string), rate (number, total linehaul in USD), miles (number or null), origin (string 'City, ST' or null), dest (string 'City, ST' or null), pickup_date (YYYY-MM-DD or null), ref (string load/PO number or null), commodity (string or null), notes (string, anything important like detention or appointment, or null). If a value is unknown use null. Never invent numbers.";
      const out=await callClaude([{role:"user",content:text}],sys,700);
      const j=parseJSON(out);
      if(j.rate&&j.miles&&!j.rpm) j.rpm=j.rate/j.miles;
      setDraft(j);
    }catch(e){ setErr("Couldn't read that one. Paste the rate con text including broker, rate, and miles, then try again."); }
    setBusy(false);
  }
  function add(){
    const l={id:uid(),status:"Available",date:draft.pickup_date||todayISO(),
      broker:draft.broker||"Unknown broker",rate:draft.rate??null,miles:draft.miles??null,
      rpm:(draft.rate&&draft.miles)?draft.rate/draft.miles:null,
      origin:draft.origin||null,dest:draft.dest||null,ref:draft.ref||null,driver:null,unit:null,pay:null,fuel:null};
    onAdd(l);
    const nr=[{when:new Date().toLocaleString(),broker:l.broker,rate:l.rate,miles:l.miles},...recent].slice(0,8);
    setRecent(nr); sset(KEY_INBOX,nr,true);
    setDraft(null); setText("");
  }
  return (
    <div className="flex flex-col lg:flex-row" style={{gap:14}}>
      <div className="flex-1" style={{minWidth:0}}>
        <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:14}}>
          <Label style={{marginBottom:8}}>Paste a rate con / broker email</Label>
          <textarea value={text} onChange={e=>setText(e.target.value)} rows={9}
            placeholder={"Paste the broker's email or rate confirmation here.\n\nExample: 'TQL — Dallas TX to Memphis TN, 452 mi, $1,450 all in, PU 6/19 0800, ref 88231, dry van.'"}
            style={{width:"100%",background:C.bg,border:`1px solid ${C.line}`,borderRadius:7,color:C.ink,
              padding:"11px",fontFamily:mono,fontSize:12.5,resize:"vertical"}}/>
          <div className="flex items-center justify-between" style={{marginTop:10,gap:10}}>
            <div style={{fontFamily:sans,fontSize:11,color:C.faint,maxWidth:330}}>Reads text you paste. It does not connect to your live inbox — see the note below the board.</div>
            <button onClick={extract} disabled={busy} style={{fontFamily:mono,fontSize:12.5,fontWeight:700,
              color:C.bg,background:busy?C.faint:C.amber,border:"none",borderRadius:7,padding:"9px 16px",cursor:busy?"default":"pointer",whiteSpace:"nowrap"}}>
              {busy?"Reading…":"Extract load"}</button>
          </div>
          {err && <div style={{marginTop:10,color:C.red,fontFamily:mono,fontSize:11.5}}>{err}</div>}
        </div>

        {draft && (
          <div style={{marginTop:12,background:C.panel,border:`1px solid ${C.amber}55`,borderRadius:10,padding:14}}>
            <div className="flex items-center justify-between" style={{marginBottom:10}}>
              <Label style={{color:C.amber}}>Extracted — review then add</Label>
              {draft.rate&&draft.miles && <Pill color={rpmColor(draft.rate/draft.miles)}>rpm ${ (draft.rate/draft.miles).toFixed(2)}</Pill>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3" style={{gap:10}}>
              {[["Broker",draft.broker],["Rate",draft.rate!=null?money(draft.rate):"—"],["Miles",draft.miles!=null?fmt0(draft.miles):"—"],
                ["Origin",draft.origin||"—"],["Dest",draft.dest||"—"],["Pickup",draft.pickup_date||"—"],
                ["Ref",draft.ref||"—"],["Commodity",draft.commodity||"—"]].map((f,i)=>(
                <div key={i}><Label style={{fontSize:9}}>{f[0]}</Label>
                  <div style={{fontFamily:mono,fontSize:13,color:C.ink,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f[1]}</div></div>
              ))}
            </div>
            {draft.notes && <div style={{marginTop:10,fontFamily:sans,fontSize:11.5,color:C.dim}}>Note: {draft.notes}</div>}
            <button onClick={add} style={{marginTop:12,fontFamily:mono,fontSize:12.5,fontWeight:700,color:C.bg,
              background:C.green,border:"none",borderRadius:7,padding:"9px 16px",cursor:"pointer"}}>+ Add to board (Available)</button>
          </div>
        )}
      </div>

      <div style={{width:"100%",maxWidth:320}}>
        <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:14}}>
          <Label style={{marginBottom:10}}>Recently captured</Label>
          {recent.length===0 && <div style={{fontFamily:mono,fontSize:11,color:C.faint}}>Nothing yet. Extracted loads show up here.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {recent.map((r,i)=>(
              <div key={i} style={{padding:"8px 10px",background:C.panel2,border:`1px solid ${C.line}`,borderRadius:7}}>
                <div style={{fontFamily:sans,fontSize:12.5,color:C.ink,fontWeight:600}}>{r.broker}</div>
                <div style={{fontFamily:mono,fontSize:10.5,color:C.dim,marginTop:2}}>{money(r.rate)} · {fmt0(r.miles)}mi · {r.when}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ TEAM CHAT ============================ */
function Chat({loads}){
  const [msgs,setMsgs]=useState([]); const [who,setWho]=useState("");
  const [body,setBody]=useState(""); const [tag,setTag]=useState(""); const endRef=useRef(null);
  useEffect(()=>{ sget(KEY_CHAT,true).then(v=>{ if(v) setMsgs(v); }); },[]);
  useEffect(()=>{ endRef.current&&endRef.current.scrollIntoView({behavior:"smooth"}); },[msgs]);
  const active=useMemo(()=>loads.filter(l=>l.status!=="Delivered"),[loads]);
  async function send(){
    if(!body.trim()) return;
    const m={id:uid(),who:who.trim()||"Dispatch",body:body.trim(),tag:tag||null,ts:Date.now()};
    const next=[...msgs,m].slice(-200); setMsgs(next); setBody(""); await sset(KEY_CHAT,next,true);
  }
  return (
    <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,display:"flex",flexDirection:"column",height:620,maxWidth:760,margin:"0 auto"}}>
      <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.lineSoft}`}} className="flex items-center justify-between">
        <div><Label>Team channel</Label><div style={{fontFamily:sans,fontSize:13,color:C.ink,marginTop:2}}>Active loads thread · shared with everyone on this board</div></div>
        <Pill color={C.green} bg={C.green+"1a"}>{active.length} active</Pill>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10}}>
        {msgs.length===0 && <div style={{fontFamily:mono,fontSize:12,color:C.faint,margin:"auto",textAlign:"center"}}>No messages yet.<br/>Post an update about an active load to start the thread.</div>}
        {msgs.map(m=>{
          const tl=active.find(l=>l.id===m.tag);
          return (
            <div key={m.id} style={{background:C.panel2,border:`1px solid ${C.line}`,borderRadius:8,padding:"9px 11px"}}>
              <div className="flex items-center justify-between" style={{marginBottom:4}}>
                <span style={{fontFamily:mono,fontSize:12,fontWeight:700,color:C.amber}}>{m.who}</span>
                <span style={{fontFamily:mono,fontSize:10,color:C.faint}}>{new Date(m.ts).toLocaleString()}</span>
              </div>
              {m.tag && <div style={{marginBottom:5}}><Pill color={C.blue} bg={C.blue+"15"}>{tl?(tl.broker+" · "+money(tl.rate)):"load"}</Pill></div>}
              <div style={{fontFamily:sans,fontSize:13.5,color:C.ink,whiteSpace:"pre-wrap"}}>{m.body}</div>
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>
      <div style={{padding:12,borderTop:`1px solid ${C.lineSoft}`}}>
        <div className="flex" style={{gap:8,marginBottom:8}}>
          <input value={who} onChange={e=>setWho(e.target.value)} placeholder="Your name"
            style={{width:130,background:C.bg,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"7px 10px",fontFamily:mono,fontSize:12}}/>
          <select value={tag} onChange={e=>setTag(e.target.value)} style={{...selStyle,flex:1}}>
            <option value="">Tag a load (optional)</option>
            {active.map(l=><option key={l.id} value={l.id}>{l.broker} · {money(l.rate)} · {l.driver||"open"}</option>)}
          </select>
        </div>
        <div className="flex" style={{gap:8}}>
          <input value={body} onChange={e=>setBody(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Message your team…"
            style={{flex:1,background:C.bg,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"9px 12px",fontFamily:sans,fontSize:13.5}}/>
          <button onClick={send} style={{fontFamily:mono,fontSize:12.5,fontWeight:700,color:C.bg,background:C.amber,border:"none",borderRadius:6,padding:"9px 16px",cursor:"pointer"}}>Send</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ COPILOT ============================ */
function Copilot({loads}){
  const [msgs,setMsgs]=useState([{role:"assistant",content:"I'm your dispatch copilot. I can see your board. Ask me to pair open loads with drivers, flag thin-margin freight, rank brokers by RPM, or draft a reply to a broker."}]);
  const [input,setInput]=useState(""); const [busy,setBusy]=useState(false); const endRef=useRef(null);
  useEffect(()=>{ endRef.current&&endRef.current.scrollIntoView({behavior:"smooth"}); },[msgs,busy]);
  const ctx=useMemo(()=>{
    const active=loads.filter(l=>l.status!=="Delivered").map(l=>({broker:l.broker,rate:l.rate,miles:l.miles,rpm:computeRpm(l)?+computeRpm(l).toFixed(2):null,status:l.status,driver:l.driver,origin:l.origin,dest:l.dest,dispatchFee:l.dispatch||null,repair:l.repair||null,net:Math.round(netOf(l))}));
    const byDrv={};
    loads.forEach(l=>{ if(!l.driver)return; const d=byDrv[l.driver]||(byDrv[l.driver]={loads:0,rpmN:0,rpmC:0,brokers:{}}); d.loads++; const r=computeRpm(l); if(r){d.rpmN+=r;d.rpmC++;} if(l.broker)d.brokers[l.broker]=(d.brokers[l.broker]||0)+1; });
    const drivers=Object.entries(byDrv).map(([k,v])=>({driver:k,loads:v.loads,avgRpm:v.rpmC?+(v.rpmN/v.rpmC).toFixed(2):null,topBrokers:Object.entries(v.brokers).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0])}));
    return {active,drivers};
  },[loads]);
  async function send(){
    if(!input.trim()||busy) return;
    const next=[...msgs,{role:"user",content:input.trim()}]; setMsgs(next); setInput(""); setBusy(true);
    try{
      const sys="You are a sharp truckload dispatch copilot for a small carrier. Be concise and decisive, use the data given. RPM under $1.80 is thin, $1.80-2.49 is ok, $2.50+ is strong. When pairing loads to drivers, prefer the driver whose recent brokers/lanes match. Current board state JSON: "+JSON.stringify(ctx);
      const apiMsgs=next.filter(m=>m.role!=="assistant"||m!==next[0]).map(m=>({role:m.role,content:m.content}));
      const out=await callClaude(apiMsgs,sys,900);
      setMsgs([...next,{role:"assistant",content:out}]);
    }catch(e){ setMsgs([...next,{role:"assistant",content:"I couldn't reach the model just now. Try again in a moment."}]); }
    setBusy(false);
  }
  return (
    <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,display:"flex",flexDirection:"column",height:620,maxWidth:760,margin:"0 auto"}}>
      <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.lineSoft}`}} className="flex items-center justify-between">
        <div><Label>Dispatch copilot</Label><div style={{fontFamily:sans,fontSize:13,color:C.ink,marginTop:2}}>Reads your live board · {ctx.active.length} active loads</div></div>
        <Pill color={C.purple} bg={C.purple+"1a"}>AI</Pill>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:11}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"86%",
            background:m.role==="user"?C.amber:C.panel2,color:m.role==="user"?C.bg:C.ink,
            border:m.role==="user"?"none":`1px solid ${C.line}`,borderRadius:9,padding:"9px 12px",
            fontFamily:sans,fontSize:13.5,whiteSpace:"pre-wrap",lineHeight:1.45}}>{m.content}</div>
        ))}
        {busy && <div style={{alignSelf:"flex-start",fontFamily:mono,fontSize:12,color:C.faint}}>thinking…</div>}
        <div ref={endRef}/>
      </div>
      <div style={{padding:12,borderTop:`1px solid ${C.lineSoft}`}} className="flex" >
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="e.g. Pair my open loads with the best driver" style={{flex:1,background:C.bg,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"9px 12px",fontFamily:sans,fontSize:13.5,marginRight:8}}/>
        <button onClick={send} disabled={busy} style={{fontFamily:mono,fontSize:12.5,fontWeight:700,color:C.bg,background:busy?C.faint:C.purple,border:"none",borderRadius:6,padding:"9px 16px",cursor:busy?"default":"pointer"}}>Ask</button>
      </div>
    </div>
  );
}

/* ============================ NEW LOAD MODAL ============================ */
function NewLoad({onClose,onSave,drivers}){
  const [f,setF]=useState({broker:"",rate:"",miles:"",origin:"",dest:"",driver:"",date:todayISO()});
  const set=(k,v)=>setF({...f,[k]:v});
  const rpm=(f.rate&&f.miles)?(parseFloat(f.rate)/parseFloat(f.miles)):null;
  function save(){
    const l={id:uid(),status:f.driver?"Assigned":"Available",date:f.date,broker:f.broker||"Unknown broker",
      rate:f.rate?parseFloat(f.rate):null,miles:f.miles?parseFloat(f.miles):null,
      rpm:rpm,origin:f.origin||null,dest:f.dest||null,driver:f.driver||null,unit:null,pay:null,fuel:null,ref:null};
    onSave(l);
  }
  const inp={width:"100%",background:C.bg,border:`1px solid ${C.line}`,borderRadius:6,color:C.ink,padding:"9px 11px",fontFamily:mono,fontSize:12.5};
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000000aa",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:12,padding:18,width:"100%",maxWidth:440}}>
        <div className="flex items-center justify-between" style={{marginBottom:14}}>
          <div style={{fontFamily:sans,fontSize:16,fontWeight:700,color:C.ink}}>New load</div>
          {rpm!=null && <Pill color={rpmColor(rpm)} bg={rpmColor(rpm)+"1a"}>rpm ${rpm.toFixed(2)} · {rpmLabel(rpm)}</Pill>}
        </div>
        <div className="grid grid-cols-2" style={{gap:10}}>
          <div className="col-span-2"><Label style={{marginBottom:4}}>Broker</Label><input style={inp} value={f.broker} onChange={e=>set("broker",e.target.value)}/></div>
          <div><Label style={{marginBottom:4}}>Rate $</Label><input style={inp} value={f.rate} onChange={e=>set("rate",e.target.value)} inputMode="decimal"/></div>
          <div><Label style={{marginBottom:4}}>Miles</Label><input style={inp} value={f.miles} onChange={e=>set("miles",e.target.value)} inputMode="numeric"/></div>
          <div><Label style={{marginBottom:4}}>Origin</Label><input style={inp} value={f.origin} onChange={e=>set("origin",e.target.value)} placeholder="Dallas, TX"/></div>
          <div><Label style={{marginBottom:4}}>Dest</Label><input style={inp} value={f.dest} onChange={e=>set("dest",e.target.value)} placeholder="Memphis, TN"/></div>
          <div><Label style={{marginBottom:4}}>Pickup</Label><input style={inp} type="date" value={f.date} onChange={e=>set("date",e.target.value)}/></div>
          <div><Label style={{marginBottom:4}}>Driver</Label>
            <select style={{...inp,color:C.ink}} value={f.driver} onChange={e=>set("driver",e.target.value)}>
              <option value="">Leave open</option>{drivers.map(d=><option key={d} value={d}>{d}</option>)}
            </select></div>
        </div>
        <div className="flex justify-end" style={{gap:8,marginTop:16}}>
          <button onClick={onClose} style={{fontFamily:mono,fontSize:12.5,color:C.dim,background:C.raised,border:`1px solid ${C.line}`,borderRadius:7,padding:"9px 15px",cursor:"pointer"}}>Cancel</button>
          <button onClick={save} style={{fontFamily:mono,fontSize:12.5,fontWeight:700,color:C.bg,background:C.amber,border:"none",borderRadius:7,padding:"9px 18px",cursor:"pointer"}}>Add load</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ APP ============================ */
const NAV=[["board","Board"],["loads","Loads"],["drivers","Drivers"],["pnl","Weekly P&L"],["monthly","Monthly P&L"],["lanes","Lane Book"],["inbox","Rate Cons"],["chat","Team"],["copilot","Copilot"]];
export default function App(){
  const [loads,setLoadsRaw]=useState(SEED);
  const [view,setView]=useState("board");
  const [ready,setReady]=useState(false);
  const [showNew,setShowNew]=useState(false);

  useEffect(()=>{(async()=>{
    const saved=await sget(KEY_LOADS,true);
    if(saved&&Array.isArray(saved)&&saved.length){ setLoadsRaw(saved); }
    else { await sset(KEY_LOADS,SEED,true); }
    setReady(true);
  })();},[]);
  function setLoads(next){ setLoadsRaw(next); sset(KEY_LOADS,next,true); }
  function addLoad(l){ setLoads([l,...loads]); }

  const drivers=useMemo(()=>{
    const s=new Set(DRIVER_ORDER); loads.forEach(l=>l.driver&&s.add(l.driver)); return Array.from(s);
  },[loads]);

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.ink,fontFamily:sans}}>
      {/* header */}
      <div style={{borderBottom:`1px solid ${C.line}`,background:C.panel,position:"sticky",top:0,zIndex:20}}>
        <div style={{maxWidth:1280,margin:"0 auto",padding:"12px 18px"}} className="flex items-center justify-between">
          <div className="flex items-center" style={{gap:12}}>
            <div style={{width:34,height:34,borderRadius:8,background:C.amber,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontFamily:mono,fontWeight:800,color:C.bg,fontSize:17}}>L</span>
            </div>
            <div>
              <div style={{fontFamily:sans,fontWeight:800,fontSize:16,letterSpacing:.5,color:C.ink}}>LOADED LOGISTICS</div>
              <div style={{fontFamily:mono,fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:C.faint}}>Dispatch terminal</div>
            </div>
          </div>
          <div className="flex items-center" style={{gap:8}}>
            <div style={{width:7,height:7,borderRadius:9,background:ready?C.green:C.amber}}/>
            <span style={{fontFamily:mono,fontSize:10.5,color:C.dim}}>{ready?"synced":"loading"}</span>
          </div>
        </div>
        {/* nav */}
        <div style={{maxWidth:1280,margin:"0 auto",padding:"0 18px"}}>
          <div className="flex" style={{gap:2,overflowX:"auto"}}>
            {NAV.map(([id,label])=>(
              <button key={id} onClick={()=>setView(id)} style={{fontFamily:sans,fontSize:12.5,fontWeight:600,letterSpacing:.4,
                color:view===id?C.ink:C.dim,background:"transparent",border:"none",borderBottom:`2px solid ${view===id?C.amber:"transparent"}`,
                padding:"10px 14px",cursor:"pointer",whiteSpace:"nowrap"}}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:1280,margin:"0 auto",padding:"16px 18px 60px"}}>
        <div style={{marginBottom:16}}><KpiBar loads={loads}/></div>
        {view==="board" && <Board loads={loads} setLoads={setLoads} drivers={drivers} onNewLoad={()=>setShowNew(true)}/>}
        {view==="loads" && <Ledger loads={loads}/>}
        {view==="drivers" && <Drivers loads={loads}/>}
        {view==="pnl" && <WeeklyPnL loads={loads}/>}
        {view==="monthly" && <MonthlyPnL loads={loads}/>}
        {view==="lanes" && <LaneBook loads={loads}/>}
        {view==="inbox" && <Inbox onAdd={addLoad}/>}
        {view==="chat" && <Chat loads={loads}/>}
        {view==="copilot" && <Copilot loads={loads}/>}

        {(view==="inbox") && (
          <div style={{marginTop:16,maxWidth:760,fontFamily:sans,fontSize:11.5,color:C.faint,lineHeight:1.5,borderTop:`1px solid ${C.lineSoft}`,paddingTop:12}}>
            On live email: this board can't read your inbox on its own — an in-app tool has no server to watch your mailbox or run on a schedule. The realistic path is paste-to-extract here, or a small backend service that forwards rate-con emails to the board. Ask and I'll spec that out.
          </div>
        )}
      </div>

      {showNew && <NewLoad drivers={drivers} onClose={()=>setShowNew(false)} onSave={l=>{addLoad(l);setShowNew(false);setView("board");}}/>}
    </div>
  );
}
