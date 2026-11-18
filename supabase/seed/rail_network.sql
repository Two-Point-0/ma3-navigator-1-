-- Prototype rail network seed. Safe to run more than once.
insert into public.rail_lines (id,name,color,speed_kmh,wait_min,base_fare,per_km) values
('L1','Nairobi - Ruiru (Thika line)','#16a34a',38,20,30,2.2),
('L2','Nairobi - Limuru (Kikuyu line)','#8b5cf6',32,25,30,2.4),
('L3','Nairobi - Lukenya (Mombasa Road line)','#d97706',40,20,40,2.6)
on conflict (id) do update set name=excluded.name,color=excluded.color,speed_kmh=excluded.speed_kmh,wait_min=excluded.wait_min,base_fare=excluded.base_fare,per_km=excluded.per_km;

insert into public.rail_stations (id,name,lat,lon,approx) values
('NRB','Nairobi Central Station',-1.2907,36.8283,true),
('MKD','Makadara',-1.2968,36.8588,true),
('KRB','Kariobangi South',-1.2693768,36.8873653,false),
('MWK','Mwiki',-1.2350815,36.9370912,false),
('RUI','Ruiru',-1.150303,36.9605273,false),
('JAM','Jamuhuri',-1.3045149,36.7680792,false),
('KIB','Kibera',-1.3057767,36.7696658,false),
('SAT','Satellite',-1.2985823,36.7453812,false),
('LEN','Lenana Halt',-1.30265,36.7301104,false),
('MUT','Mutuini',-1.2963818,36.7064086,false),
('DAG','Dagoretti Market',-1.28442,36.6828532,false),
('THO','Thogoto',-1.2663887,36.6771667,false),
('GIT','Gitaru',-1.2373738,36.6751103,false),
('KIK','Kikuyu',-1.2461656,36.6609366,false),
('MUG','Muguga',-1.1787125,36.6489392,false),
('LIM','Limuru',-1.1150876,36.6427913,false),
('UMO','Umoja / Mutindwa',-1.2861195,36.8838762,false),
('AVI','Aviation',-1.3197544,36.9060491,false),
('IMD','Imara Daima',-1.3283403,36.8742201,false),
('EMB','Embakasi',-1.3505949,36.8941437,false),
('TRM','Nairobi Terminus (SGR)',-1.3553597,36.8980718,false),
('MLO','Mlolongo',-1.3990488,36.9345142,false),
('ATH','Athi River',-1.449094,36.9754339,false),
('LUK','Lukenya',-1.5235111,36.9654496,false)
on conflict (id) do update set name=excluded.name,lat=excluded.lat,lon=excluded.lon,approx=excluded.approx;

insert into public.rail_line_stations (line_id,seq,station_id) values
('L1',1,'NRB'),
('L1',2,'MKD'),
('L1',3,'KRB'),
('L1',4,'MWK'),
('L1',5,'RUI'),
('L2',1,'NRB'),
('L2',2,'JAM'),
('L2',3,'KIB'),
('L2',4,'SAT'),
('L2',5,'LEN'),
('L2',6,'MUT'),
('L2',7,'DAG'),
('L2',8,'THO'),
('L2',9,'GIT'),
('L2',10,'KIK'),
('L2',11,'MUG'),
('L2',12,'LIM'),
('L3',1,'NRB'),
('L3',2,'MKD'),
('L3',3,'UMO'),
('L3',4,'AVI'),
('L3',5,'IMD'),
('L3',6,'EMB'),
('L3',7,'TRM'),
('L3',8,'MLO'),
('L3',9,'ATH'),
('L3',10,'LUK')
on conflict (line_id,seq) do update set station_id=excluded.station_id;
