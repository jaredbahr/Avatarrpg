# Per-frame facing and pitch (slinger hits and knockouts)

gates.py [--md OUT.md] : per-frame facing and pitch table for the slinger's hit and knockout takes (cels/<clip>/NN.png, the
toned 192 px cels the packer reads), measured against each take's own frame 0 = the slinger's idle cel 0 for that facing.

## hitEast (east, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy      |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------ |
| 0   | stance | 40  | 157    | 39  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 38      | 1.0    | True      | 0            |
| 1   | 0      | 70  | 154    | 40  | 0.981 | 1.016 | 0.035    | True    | -0.009      | 34      | 1.0    | True      | 0 PITCH-FAIL |
| 2   | 1      | 120 | 152    | 50  | 0.968 | 1.018 | 0.050    | True    | 0.003       | 37      | 1.0    | True      | 0 PITCH-FAIL |
| 3   | 2      | 80  | 153    | 41  | 0.975 | 1.007 | 0.033    | True    | -0.024      | 33      | 1.0    | True      | 0 PITCH-FAIL |
| 4   | stance | 90  | 157    | 39  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 38      | 1.0    | True      | 0            |

## hitNorth (north, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy      |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------ |
| 0   | stance | 40  | 154    | 77  | 1.000 | 1.000 | 0.000    | True    | -           | 0       | 1.0    | True      | 0            |
| 1   | 0      | 70  | 147    | 67  | 0.955 | 1.015 | 0.061    | True    | -           | 0       | 1.03   | True      | 0 PITCH-FAIL |
| 2   | 1      | 120 | 146    | 75  | 0.948 | 1.010 | 0.062    | True    | -           | 0       | 1.07   | True      | 0 PITCH-FAIL |
| 3   | 2      | 80  | 146    | 66  | 0.948 | 1.004 | 0.056    | True    | -           | 0       | 1.03   | True      | 0 PITCH-FAIL |
| 4   | stance | 90  | 154    | 77  | 1.000 | 1.000 | 0.000    | True    | -           | 0       | 1.0    | True      | 0            |

## hitNorthEast (north-east, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy                  |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------------------ |
| 0   | stance | 40  | 157    | 60  | 1.000 | 1.000 | 0.000    | True    | -           | 0       | 1.0    | True      | 0                        |
| 1   | 0      | 70  | 157    | 64  | 1.000 | 1.023 | 0.023    | True    | 0.251       | 82      | 1.07   | False     | 0 FACING-FAIL            |
| 2   | 1      | 120 | 156    | 63  | 0.994 | 1.026 | 0.032    | True    | 0.229       | 88      | 1.07   | False     | 0 PITCH-FAIL FACING-FAIL |
| 3   | 2      | 80  | 156    | 64  | 0.994 | 1.010 | 0.017    | True    | 0.253       | 84      | 1.07   | False     | 0 FACING-FAIL            |
| 4   | stance | 90  | 157    | 60  | 1.000 | 1.000 | 0.000    | True    | -           | 0       | 1.0    | True      | 0                        |

## hitNorthWest (north-west, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy                  |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------------------ |
| 0   | stance | 40  | 158    | 63  | 1.000 | 1.000 | 0.000    | True    | -           | 0       | 1.0    | True      | 0                        |
| 1   | 0      | 70  | 152    | 64  | 0.962 | 0.989 | 0.027    | True    | -           | 0       | 1.25   | False     | 0 FACING-FAIL            |
| 2   | 1      | 120 | 148    | 69  | 0.937 | 0.968 | 0.032    | True    | -           | 0       | 1.25   | False     | 0 PITCH-FAIL FACING-FAIL |
| 3   | 2      | 80  | 152    | 63  | 0.962 | 0.987 | 0.025    | True    | -0.153      | 1       | 1.29   | False     | 0 FACING-FAIL            |
| 4   | stance | 90  | 158    | 63  | 1.000 | 1.000 | 0.000    | True    | -           | 0       | 1.0    | True      | 0                        |

## hitSouth (south, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy                  |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------------------ |
| 0   | stance | 40  | 156    | 76  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 98      | 1.0    | True      | 0                        |
| 1   | 0      | 70  | 150    | 77  | 0.962 | 0.982 | 0.021    | True    | -0.012      | 86      | 1.0    | True      | 0                        |
| 2   | 1      | 120 | 144    | 84  | 0.923 | 0.962 | 0.038    | True    | 0.104       | 93      | 1.28   | False     | 0 PITCH-FAIL FACING-FAIL |
| 3   | 2      | 80  | 148    | 73  | 0.949 | 0.985 | 0.036    | True    | -0.007      | 94      | 0.97   | True      | 0 PITCH-FAIL             |
| 4   | stance | 90  | 156    | 76  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 98      | 1.0    | True      | 0                        |

## hitSouthEast (south-east, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy                  |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------------------ |
| 0   | stance | 40  | 157    | 71  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 42      | 1.0    | True      | 0                        |
| 1   | 0      | 70  | 151    | 62  | 0.962 | 1.001 | 0.040    | True    | 0.076       | 49      | 1.39   | False     | 0 PITCH-FAIL FACING-FAIL |
| 2   | 1      | 120 | 150    | 68  | 0.955 | 0.995 | 0.040    | True    | -0.042      | 64      | 1.65   | False     | 0 PITCH-FAIL FACING-FAIL |
| 3   | 2      | 80  | 152    | 62  | 0.968 | 0.998 | 0.030    | True    | 0.065       | 51      | 1.32   | False     | 0 FACING-FAIL            |
| 4   | stance | 90  | 157    | 71  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 42      | 1.0    | True      | 0                        |

## hitSouthWest (south-west, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy       |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------------- |
| 0   | stance | 40  | 154    | 58  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 49      | 1.0    | True      | 0             |
| 1   | 0      | 70  | 146    | 68  | 0.948 | 0.974 | 0.026    | True    | -0.043      | 44      | 1.23   | False     | 0 FACING-FAIL |
| 2   | 1      | 120 | 141    | 75  | 0.916 | 0.932 | 0.016    | True    | -0.048      | 45      | 1.23   | False     | 0 FACING-FAIL |
| 3   | 2      | 80  | 146    | 68  | 0.948 | 0.973 | 0.025    | True    | -0.059      | 56      | 1.23   | False     | 0 FACING-FAIL |
| 4   | stance | 90  | 154    | 58  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 49      | 1.0    | True      | 0             |

## hitWest (west, 5 frames, hit)

| f   | src    | ms  | height | w   | ratio | pred  | size pop | upright | face offset | skin px | head w | facing ok | foot dy |
| --- | ------ | --- | ------ | --- | ----- | ----- | -------- | ------- | ----------- | ------- | ------ | --------- | ------- |
| 0   | stance | 40  | 158    | 43  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 34      | 1.0    | True      | 0       |
| 1   | 0      | 70  | 151    | 47  | 0.956 | 0.976 | 0.020    | True    | 0.018       | 33      | 1.0    | True      | 0       |
| 2   | 1      | 120 | 144    | 57  | 0.911 | 0.938 | 0.027    | True    | 0.008       | 34      | 1.0    | True      | 0       |
| 3   | 2      | 80  | 151    | 48  | 0.956 | 0.975 | 0.020    | True    | 0.031       | 33      | 1.0    | True      | 0       |
| 4   | stance | 90  | 158    | 43  | 1.000 | 1.000 | 0.000    | True    | 0.0         | 34      | 1.0    | True      | 0       |

## koNorthEast (north-east, 7 frames, ko)

| f   | src    | ms  | height | w   | ratio | pred  | size pop    | upright | face offset | skin px | head w | facing ok    | foot dy |
| --- | ------ | --- | ------ | --- | ----- | ----- | ----------- | ------- | ----------- | ------- | ------ | ------------ | ------- |
| 0   | stance | 40  | 157    | 60  | 1.000 | 1.000 | 0.000       | True    | -           | 0       | 1.0    | True         | 0       |
| 1   | 0      | 80  | 130    | 94  | 0.828 | 0.803 | 0.025       | True    | -           | 0       | 1.03   | True         | -21     |
| 2   | 1      | 60  | 109    | 126 | 0.694 | 0.605 | 0.090 (n/a) | False   | -           | 0       | 1.1    | True (info)  | -21     |
| 3   | 2      | 50  | 96     | 144 | 0.611 | 0.429 | 0.182 (n/a) | False   | 0.163       | 2       | 1.48   | False (info) | -10     |
| 4   | 3      | 110 | 84     | 160 | 0.535 | 0.200 | 0.335 (n/a) | False   | 0.224       | 122     | 5.48   | False (info) | 0       |
| 5   | 4      | 90  | 84     | 178 | 0.535 | 0.169 | 0.366 (n/a) | False   | 0.239       | 89      | 1.66   | False (info) | -10     |
| 6   | 5      | 400 | 74     | 181 | 0.471 | 0.179 | 0.293 (n/a) | False   | 0.3         | 82      | 2.17   | False (info) | -12     |

## koNorthWest (north-west, 7 frames, ko)

| f   | src    | ms  | height | w   | ratio | pred   | size pop    | upright | face offset | skin px | head w | facing ok    | foot dy |
| --- | ------ | --- | ------ | --- | ----- | ------ | ----------- | ------- | ----------- | ------- | ------ | ------------ | ------- |
| 0   | stance | 40  | 158    | 63  | 1.000 | 1.000  | 0.000       | True    | -           | 0       | 1.0    | True         | 0       |
| 1   | 0      | 80  | 124    | 92  | 0.785 | 0.801  | 0.016       | True    | -           | 0       | 1.04   | True         | -25     |
| 2   | 1      | 60  | 93     | 117 | 0.589 | 0.595  | 0.006 (n/a) | False   | -           | 0       | 1.21   | False (info) | -36     |
| 3   | 2      | 50  | 79     | 140 | 0.500 | 0.404  | 0.096 (n/a) | False   | -0.424      | 19      | 3.36   | False (info) | -22     |
| 4   | 3      | 110 | 81     | 158 | 0.513 | 0.122  | 0.391 (n/a) | False   | 0.022       | 142     | 2.75   | False (info) | -12     |
| 5   | 4      | 90  | 82     | 166 | 0.519 | -0.018 | 0.537 (n/a) | False   | -0.219      | 187     | 2.89   | False (info) | -9      |
| 6   | 5      | 400 | 73     | 166 | 0.462 | 0.037  | 0.425 (n/a) | False   | -0.129      | 185     | 4.46   | False (info) | -3      |

## koSouthEast (south-east, 7 frames, ko)

| f   | src    | ms  | height | w   | ratio | pred  | size pop    | upright | face offset | skin px | head w | facing ok    | foot dy      |
| --- | ------ | --- | ------ | --- | ----- | ----- | ----------- | ------- | ----------- | ------- | ------ | ------------ | ------------ |
| 0   | stance | 40  | 157    | 71  | 1.000 | 1.000 | 0.000       | True    | 0.0         | 42      | 1.0    | True         | 0            |
| 1   | 0      | 80  | 160    | 96  | 1.019 | 1.060 | 0.041       | True    | -0.016      | 43      | 0.94   | True         | 5 PITCH-FAIL |
| 2   | 1      | 60  | 146    | 120 | 0.930 | 0.986 | 0.056       | True    | -0.043      | 65      | 1.0    | True         | 6 PITCH-FAIL |
| 3   | 2      | 50  | 120    | 137 | 0.764 | 0.774 | 0.010 (n/a) | False   | -0.098      | 99      | 1.29   | False (info) | 4            |
| 4   | 3      | 110 | 66     | 156 | 0.420 | 0.409 | 0.011 (n/a) | False   | -0.167      | 262     | 4.65   | False (info) | -2           |
| 5   | 4      | 90  | 81     | 172 | 0.516 | 0.268 | 0.248 (n/a) | False   | -0.121      | 147     | 2.48   | False (info) | 8            |
| 6   | 5      | 400 | 72     | 171 | 0.459 | 0.282 | 0.176 (n/a) | False   | -0.305      | 200     | 3.13   | False (info) | -2           |

## koSouthWest (south-west, 7 frames, ko)

| f   | src    | ms  | height | w   | ratio | pred  | size pop    | upright | face offset | skin px | head w | facing ok    | foot dy       |
| --- | ------ | --- | ------ | --- | ----- | ----- | ----------- | ------- | ----------- | ------- | ------ | ------------ | ------------- |
| 0   | stance | 40  | 154    | 58  | 1.000 | 1.000 | 0.000       | True    | 0.0         | 49      | 1.0    | True         | 0             |
| 1   | 0      | 80  | 154    | 97  | 1.000 | 1.039 | 0.039       | True    | -0.0        | 48      | 1.03   | True         | 5 PITCH-FAIL  |
| 2   | 1      | 60  | 145    | 121 | 0.942 | 0.985 | 0.043       | True    | -0.07       | 60      | 1.07   | True         | 11 PITCH-FAIL |
| 3   | 2      | 50  | 119    | 137 | 0.773 | 0.795 | 0.022 (n/a) | False   | 0.0         | 64      | 1.27   | False (info) | 12            |
| 4   | 3      | 110 | 57     | 156 | 0.370 | 0.427 | 0.057 (n/a) | False   | 0.093       | 166     | 4.9    | False (info) | -12           |
| 5   | 4      | 90  | 61     | 164 | 0.396 | 0.217 | 0.179 (n/a) | False   | 0.064       | 142     | 3.97   | False (info) | -6            |
| 6   | 5      | 400 | 63     | 161 | 0.409 | 0.276 | 0.133 (n/a) | False   | 0.28        | 220     | 3.67   | False (info) | -2            |
