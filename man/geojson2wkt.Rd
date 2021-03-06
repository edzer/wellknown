% Generated by roxygen2: do not edit by hand
% Please edit documentation in R/geojson2wkt.R
\name{geojson2wkt}
\alias{geojson2wkt}
\title{Convert GeoJSON-like objects to WKT.}
\usage{
geojson2wkt(obj, fmt = 16, ...)
}
\arguments{
\item{obj}{A GeoJSON-like object representing a Point, LineString, Polygon, MultiPolygon, etc.}

\item{fmt}{Format string which indicates the number of digits to display after the
decimal point when formatting coordinates.}

\item{...}{Further args passed on to \code{\link[jsonlite]{fromJSON}} only in the event of json
passed as a character string.}
}
\description{
Convert GeoJSON-like objects to WKT.
}
\examples{
# point
point <- list('type' = 'Point', 'coordinates' = c(116.4, 45.2))
geojson2wkt(point)

# multipoint
mp <- list(type = 'MultiPoint', coordinates=list(c(100.0, 3.101), c(101.0, 2.1), c(3.14, 2.18)))
geojson2wkt(mp)

# linestring
st <- list(type = 'LineString',
           coordinates = list(c(0.0, 0.0, 10.0), c(2.0, 1.0, 20.0),
                             c(4.0, 2.0, 30.0), c(5.0, 4.0, 40.0)))
geojson2wkt(st)

# multilinestring
multist <- list(type = 'MultiLineString',
     coordinates = list(
       list(c(0.0, -1.0), c(-2.0, -3.0), c(-4.0, -5.0)),
       list(c(1.66, -31023.5), c(10000.9999, 3.0), c(100.9, 1.1), c(0.0, 0.0))
     ))
geojson2wkt(multist)

# polygon
poly <- list(type = 'Polygon',
     coordinates=list(
       list(c(100.001, 0.001), c(101.12345, 0.001), c(101.001, 1.001), c(100.001, 0.001)),
       list(c(100.201, 0.201), c(100.801, 0.201), c(100.801, 0.801), c(100.201, 0.201))
))
geojson2wkt(poly)
geojson2wkt(poly, fmt=6)

# multipolygon
mpoly <- list(type = 'MultiPolygon',
              coordinates=list(
                list(list(c(100.001, 0.001), c(101.001, 0.001), c(101.001, 1.001),
                          c(100.001, 0.001)),
                     list(c(100.201, 0.201), c(100.801, 0.201), c(100.801, 0.801),
                          c(100.201, 0.201))),
                list(list(c(1.0, 2.0, 3.0, 4.0), c(5.0, 6.0, 7.0, 8.0),
                          c(9.0, 10.0, 11.0, 12.0), c(1.0, 2.0, 3.0, 4.0)))
))
geojson2wkt(mpoly, fmt=2)

mpoly2 <- list(type = "MultiPolygon",
              coordinates = list(list(list(c(30, 20), c(45, 40), c(10, 40), c(30, 20))),
                                 list(list(c(15, 5), c(40, 10), c(10, 20), c(5 ,10), c(15, 5))))
)
geojson2wkt(mpoly2, fmt=1)

# geometrycollection
gmcoll <- list(type = 'GeometryCollection',
 geometries = list(
     list(type = "Point", coordinates = list(0.0, 1.0)),
     list(type = 'LineString', coordinates = list(c(-100.0, 0.0), c(-101.0, -1.0))),
     list(type = 'Polygon',
       'coordinates' = list(list(c(100.001, 0.001),
                       c(101.1235, 0.001),
                       c(101.001, 1.001),
                       c(100.001, 0.001)),
                      list(c(100.201, 0.201),
                       c(100.801, 0.201),
                       c(100.801, 0.801),
                       c(100.201, 0.201)))
     ),
     list(type = 'MultiPoint',
       'coordinates' = list(c(100.0, 3.101), c(101.0, 2.1), c(3.14, 2.18))
     ),
     list(type = 'MultiLineString',
       coordinates = list(list(c(0.0, -1.0), c(-2.0, -3.0), c(-4.0, -5.0)),
                      list(c(1.66, -31023.5, 1.1),
                       c(10000.9999, 3.0, 2.2),
                       c(100.9, 1.1, 3.3),
                       c(0.0, 0.0, 4.4)))
     ),
     list(type = 'MultiPolygon',
          coordinates = list(
            list(list(c(100.001, 0.001),
                      c(101.001, 0.001),
                      c(101.001, 1.001),
                      c(100.001, 0.001)),
                 list(c(100.201, 0.201),
                      c(100.801, 0.201),
                      c(100.801, 0.801),
                      c(100.201, 0.201)) ),
            list(list(c(1.0, 2.0, 3.0, 4.0),
                      c(5.0, 6.0, 7.0, 8.0),
                      c(9.0, 10.0, 11.0, 12.0),
                      c(1.0, 2.0, 3.0, 4.0))))
     )
 )
)
geojson2wkt(gmcoll, fmt=0)

# Convert geojson as character string to WKT
str <- '
{
   "type": "Point",
   "coordinates": [
       -105.01621,
       39.57422
   ]
}'
geojson2wkt(str)

str <- '{"type":["LineString"],"coordinates":[[0,0,10],[2,1,20],[4,2,30],[5,4,40]]}'
geojson2wkt(str)

# From a jsonlite json object
library("jsonlite")
json <- toJSON(list(type="Point", coordinates=c(-105,39)))
geojson2wkt(json)

}
\seealso{
\code{\link{wkt2geojson}}
}

