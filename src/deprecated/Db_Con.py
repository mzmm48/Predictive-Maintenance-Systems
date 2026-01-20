import psycopg2
import pandas as pd
class TimescaleDB:
    #baut eine Verbindung auf und stellt Variablen zur Verfügung
    def __init__(self, connection_string):
        #Baut die Verbindung mit der Datenbank auf mit psycopg2
        self.connection_string = connection_string
        #baut die Verbindung mit der Datenbank mit psycopg2 auf als conn
        self.conn = psycopg2.connect(connection_string)
        #erstellt ein cursor Objekt, über welches man mit der Datenbank in SQL-Sprache kommuniziert
        self.cursor = self.conn.cursor()
    def query(self, sql, params=None):
       #führt den angebenen SQL Befehl aus
       self.cursor.execute(sql)
       #speichert ins rows, eine Liste von Tupeln aus, die man vom cursor/Datenbank bekommt.
       return self.cursor.fetchall()
       #druckt rows aus
       print(rows)
    def discon(self):
       #speichert Änderungen dauerhaft
       self.conn.commit()
       #schließt die Verbindung zwischen cursor und Pyhton
       self.cursor.close()
       #schlie0t die Verbindung mit dem Server
       self.conn.close()

#Beispiel
#test = TimescaleDB("postgres://tsdbadmin:seleneares123@b0e1bmoiny.xe7d3cm2b8.tsdb.cloud.timescale.com:31840/tsdb?sslmode=require")
#rows = test.query("SELECT * FROM ai4i2020V2")
#columns = [
#"TS", "UDI", "Product ID", "Type", "Air temperature [K]","Process temperature [K]", "Rotational speed [rpm]",
#"Torque [Nm]", "Tool wear [min]", "Machine failure", "TWF", "HDF", "PWF", "OSF", "RNF"]
#df = pd.DataFrame(rows, columns=columns)
#print(df)
#test.discon