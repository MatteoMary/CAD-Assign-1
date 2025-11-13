## Assignment - Cloud App Development.

__Name:__ Matteo Mary

### Links.
__Demo:__ [A link to your YouTube video demonstration.](https://youtu.be/aQGSi4KPuAo)

https://github.com/MatteoMary/CAD-Assign-1

### Screenshots.

[A screenshot of the App Web API from the management console, e.g.

![][api]

The Auth API is not required as its code was provided in the labs.

]

[A screenshot of your seeded table from DynamoDB, e.g.

![][db]
]

[A screenshot from CloudWatch logs showing an example of User Activity logging, e.g.

[log]
]
### Design features (if required).

Design features

This API was built using the AWS CDK and follows a clean, modular serverless design.
Design features include:

Single-table DynamoDB design:
All movie, actor, cast, and award data is stored in one table using prefixed partition keys (m, a, c, w) and sort keys.

Separated Lambda functions:
Each endpoint uses its own dedicated Lambda function, keeping business logic isolated and easier to test and maintain.

Request authorizer:
A custom Lambda authorizer is used to validate Cognito users for all GET requests.

API key secured admin routes:
POST and DELETE operations require an API key through an API Gateway usage plan, separating normal users from admin users.

CDK-managed infrastructure:
All resources including tables, Lambdas, authorizers, API Gateway routes and IAM permissions are provisioned using CDK for reproducibility and consistent deployment.
###  Extra (If relevant).

N/A

[api]: /images/Screenshot%202025-11-12%20235538.png
[db]: /images/Screenshot%202025-11-13%20001443.png
[log]: /images/Screenshot%202025-11-13%20011242.png