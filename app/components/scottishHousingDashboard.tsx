"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface SPARQLBinding {
  value: string;
}

interface PriceDataBinding {
  year: { value: string };
  price: { value: string };
}

interface DwellingDataBinding {
  type: { value: string };
  total: { value: string };
}

interface PriceSPARQLResponse {
  head: {
    vars: string[];
  };
  results: {
    bindings: Array<{
      period: {
        datatype: string;
        type: string;
        value: string;
      };
      value: {
        datatype: string;
        type: string;
        value: string;
      };
      measure: {
        datatype: string;
        type: string;
        value: string;
      };
    }>;
  };
}

interface DwellingSPARQLResponse {
  head: {
    vars: string[];
  };
  results: {
    bindings: Array<{
      type: {
        type: string;
        value: string;
      };
      total: {
        type: string;
        value: string;
      };
    }>;
  };
}

interface PriceDataPoint {
  year: string;
  meanPrice: number;
  medianPrice: number;
  lowerQuartile: number;
  upperQuartile: number;
  salesCount: number;
}

interface DwellingDataPoint {
  type: string;
  total: number;
}

interface GeographyLevel {
  code: string;
  name: string;
  type: "country" | "council" | "ward";
  children?: GeographyLevel[];
}

interface AreaSelector {
  selectedCountry?: string;
  selectedCouncil?: string;
  selectedWard?: string;
}

interface DataZone {
  DZ22_Code: string;
  DZ22_Name: string;
  MMWard_Code: string;
  MMWard_Name: string;
  LA_Code: string;
  LA_Name: string;
  Country_Code: string;
  Country_Name: string;
}

interface GeographyHierarchy {
  [key: string]: {
    name: string;
    councils: {
      [key: string]: {
        name: string;
        wards: {
          [key: string]: {
            name: string;
            datazones: {
              code: string;
              name: string;
            }[];
          };
        };
      };
    };
  };
}

const ScottishHousingDashboard = () => {
  const [selectedArea, setSelectedArea] = useState("S12000033"); // Glasgow City
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [dwellingData, setDwellingData] = useState<DwellingDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [areaSelections, setAreaSelections] = useState<AreaSelector>({
    selectedCountry: "S92000003", // Scotland by default
  });
  const [geographyData, setGeographyData] = useState<GeographyHierarchy>({});

  const areas = [
    { id: "S12000033", name: "Glasgow City" },
    { id: "S12000036", name: "City of Edinburgh" },
    { id: "S12000034", name: "Aberdeen City" },
    { id: "S12000035", name: "Dundee City" },
  ];

  const fetchPriceData = async (areaCode: string) => {
    setLoading(true);
    try {
      const query = `
        PREFIX qb: <http://purl.org/linked-data/cube#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX sdmx: <http://purl.org/linked-data/sdmx/2009/dimension#>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        
        SELECT ?period ?value ?measure
        WHERE {
          ?obs qb:dataSet <http://statistics.gov.scot/data/residential-properties-sales-and-price> ;
               sdmx:refArea <http://statistics.gov.scot/id/statistical-geography/${areaCode}> ;
               sdmx:refPeriod ?period ;
               qb:measureType ?measure ;
               ?measure ?value .
        }
        ORDER BY ?period
      `;

      console.log("Sending query:", query);

      const formData = new FormData();
      formData.append("query", query);

      const response = await fetch("/api/sparql", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error response:", errorData);
        throw new Error(
          errorData.details || errorData.error || "Network response was not ok"
        );
      }

      const rawData = await response.text();
      console.log("Raw response:", rawData);

      const data = JSON.parse(rawData) as PriceSPARQLResponse;
      console.log("Parsed SPARQL Response:", {
        head: data.head,
        results: data.results,
        bindingsCount: data.results?.bindings?.length,
        firstBinding: data.results?.bindings?.[0],
      });

      if (!data.results?.bindings || !Array.isArray(data.results.bindings)) {
        throw new Error("Invalid response format");
      }

      const yearlyData = data.results.bindings.reduce<
        Record<string, PriceDataPoint>
      >((acc, item) => {
        const year = new Date(item.period.value).getFullYear().toString();
        if (!acc[year]) {
          acc[year] = {
            year,
            meanPrice: 0,
            medianPrice: 0,
            lowerQuartile: 0,
            upperQuartile: 0,
            salesCount: 0,
          };
        }

        const measureType = item.measure.value;
        if (measureType.includes("mean")) {
          acc[year].meanPrice = parseFloat(item.value.value);
        } else if (measureType.includes("median")) {
          acc[year].medianPrice = parseFloat(item.value.value);
        } else if (measureType.includes("lower-quartile")) {
          acc[year].lowerQuartile = parseFloat(item.value.value);
        } else if (measureType.includes("upper-quartile")) {
          acc[year].upperQuartile = parseFloat(item.value.value);
        } else if (measureType.includes("count")) {
          acc[year].salesCount = parseInt(item.value.value);
        }
        return acc;
      }, {});

      setPriceData(Object.values(yearlyData));
    } catch (error) {
      console.error("Error fetching price data:", error);
      setPriceData([]);
    }
    setLoading(false);
  };

  const fetchDwellingData = async (areaCode: string) => {
    try {
      const query = `
        PREFIX qb: <http://purl.org/linked-data/cube#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX sdmx: <http://purl.org/linked-data/sdmx/2009/dimension#>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        
        SELECT ?type (SUM(?count) as ?total)
        WHERE {
          ?obs qb:dataSet <http://statistics.gov.scot/data/dwellings-type> ;
               sdmx:refArea <http://statistics.gov.scot/id/statistical-geography/${areaCode}> ;
               <http://statistics.gov.scot/def/dimension/typeOfDwelling> ?typeUri ;
               <http://statistics.gov.scot/def/measure-properties/count> ?count .
          
          ?typeUri rdfs:label ?type .
        }
        GROUP BY ?type
      `;

      const formData = new FormData();
      formData.append("query", query);

      const response = await fetch("/api/sparql", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || errorData.error || "Network response was not ok"
        );
      }

      const data = (await response.json()) as DwellingSPARQLResponse;
      const formattedData = data.results.bindings.map((item) => ({
        type: item.type.value,
        total: parseInt(item.total.value),
      }));

      setDwellingData(formattedData);
    } catch (error) {
      console.error("Error fetching dwelling data:", error);
      setDwellingData([]);
    }
  };

  useEffect(() => {
    if (selectedArea) {
      fetchPriceData(selectedArea);
      fetchDwellingData(selectedArea);
    }
  }, [selectedArea]);

  useEffect(() => {
    const fetchGeographyData = async () => {
      try {
        console.log("Fetching geography data...");
        const response = await fetch("/data/DataZone2022.csv");

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();

        // Log the total length of the CSV
        console.log("Total CSV length:", csvText.length);

        const rows = csvText.split("\n").slice(1); // Skip header
        console.log(`Found ${rows.length} rows`);

        // Sample a few rows from different parts of the data
        console.log("First row:", rows[0]);
        console.log("Middle row:", rows[Math.floor(rows.length / 2)]);
        console.log("Last row:", rows[rows.length - 1]);

        const hierarchy: GeographyHierarchy = {};

        let processedRows = 0;
        const uniqueCountries = new Set();
        const uniqueCouncils = new Set();
        const uniqueWards = new Set();

        rows.forEach((row, index) => {
          const columns = row
            .split(",")
            .map((col) => col.trim().replace(/^"|"$/g, ""));

          if (columns.length < 35) {
            console.warn(`Row ${index} has insufficient columns:`, columns);
            return;
          }

          const [
            DZ22_Code,
            DZ22_Name,
            ,
            ,
            MMWard_Code,
            MMWard_Name,
            LA_Code,
            LA_Name,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            Country_Code,
            Country_Name,
          ] = columns;

          // Skip empty rows
          if (!Country_Code || !LA_Code || !MMWard_Code) {
            console.warn(`Row ${index} missing required codes:`, {
              Country_Code,
              LA_Code,
              MMWard_Code,
            });
            return;
          }

          uniqueCountries.add(Country_Code);
          uniqueCouncils.add(LA_Code);
          uniqueWards.add(MMWard_Code);
          processedRows++;

          // Rest of your existing code...
          if (!hierarchy[Country_Code]) {
            hierarchy[Country_Code] = {
              name: Country_Name,
              councils: {},
            };
          }

          if (!hierarchy[Country_Code].councils[LA_Code]) {
            hierarchy[Country_Code].councils[LA_Code] = {
              name: LA_Name,
              wards: {},
            };
          }

          if (!hierarchy[Country_Code].councils[LA_Code].wards[MMWard_Code]) {
            hierarchy[Country_Code].councils[LA_Code].wards[MMWard_Code] = {
              name: MMWard_Name,
              datazones: [],
            };
          }

          hierarchy[Country_Code].councils[LA_Code].wards[
            MMWard_Code
          ].datazones.push({
            code: DZ22_Code,
            name: DZ22_Name,
          });
        });

        console.log("Processing summary:", {
          totalRows: rows.length,
          processedRows,
          uniqueCountries: Array.from(uniqueCountries),
          uniqueCountriesCount: uniqueCountries.size,
          uniqueCouncilsCount: uniqueCouncils.size,
          uniqueWardsCount: uniqueWards.size,
        });

        console.log("Hierarchy structure:", {
          countries: Object.keys(hierarchy),
          sampleCouncils: Object.keys(
            hierarchy[Object.keys(hierarchy)[0]]?.councils || {}
          ),
          sampleWards: Object.keys(
            hierarchy[Object.keys(hierarchy)[0]]?.councils[
              Object.keys(
                hierarchy[Object.keys(hierarchy)[0]]?.councils || {}
              )[0]
            ]?.wards || {}
          ),
        });

        setGeographyData(hierarchy);
      } catch (error) {
        console.error("Error loading geography data:", error);
      }
    };

    fetchGeographyData();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col space-y-4 mb-4">
        <Select
          value={areaSelections.selectedCountry}
          onValueChange={(value) => {
            setAreaSelections({ selectedCountry: value });
            setSelectedArea(value);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(geographyData).map(([code, country]) => (
              <SelectItem key={code} value={code}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {areaSelections.selectedCountry && (
          <Select
            value={areaSelections.selectedCouncil}
            onValueChange={(value) => {
              setAreaSelections((prev) => ({
                ...prev,
                selectedCouncil: value,
                selectedWard: undefined,
              }));
              setSelectedArea(value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select council area" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(
                geographyData[areaSelections.selectedCountry]?.councils || {}
              ).map(([code, council]) => (
                <SelectItem key={code} value={code}>
                  {council.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {areaSelections.selectedCouncil && (
          <Select
            value={areaSelections.selectedWard}
            onValueChange={(value) => {
              setAreaSelections((prev) => ({ ...prev, selectedWard: value }));
              setSelectedArea(value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select ward" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(
                geographyData[areaSelections.selectedCountry]?.councils[
                  areaSelections.selectedCouncil
                ]?.wards || {}
              ).map(([code, ward]) => (
                <SelectItem key={code} value={code}>
                  {ward.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => {
              fetchPriceData(selectedArea);
              fetchDwellingData(selectedArea);
            }}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh Data"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Average House Prices Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => `£${value.toLocaleString()}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="meanPrice"
                      stroke="#8884d8"
                      name="Mean Price"
                    />
                    <Line
                      type="monotone"
                      dataKey="medianPrice"
                      stroke="#82ca9d"
                      name="Median Price"
                    />
                    <Line
                      type="monotone"
                      dataKey="upperQuartile"
                      stroke="#ffc658"
                      name="Upper Quartile"
                      strokeDasharray="3 3"
                    />
                    <Line
                      type="monotone"
                      dataKey="lowerQuartile"
                      stroke="#ff7300"
                      name="Lower Quartile"
                      strokeDasharray="3 3"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dwelling Types Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dwellingData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip formatter={(value) => value.toLocaleString()} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#82ca9d"
                      name="Number of Dwellings"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ScottishHousingDashboard;
